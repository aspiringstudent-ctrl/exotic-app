#!/usr/bin/env node
/* global clearInterval, console, setInterval */
import process from "node:process";
import mqtt from "mqtt";
import {
  getMqttServerConfig,
  loadRuntimeEnv,
  redactUrl,
} from "./lib/runtime-config.mjs";

const devices = [
  {
    id: "dev-tx-01",
    kind: "transformer",
    ratedCapacityKw: 1250,
    baselineLoadPercent: 86,
  },
  {
    id: "dev-fdr-11",
    kind: "feeder",
    ratedCapacityKw: 830,
    baselineLoadPercent: 68,
  },
  {
    id: "dev-mtr-07",
    kind: "meter",
    ratedCapacityKw: 320,
    baselineLoadPercent: 61,
  },
  {
    id: "dev-inv-03",
    kind: "inverter",
    ratedCapacityKw: 420,
    baselineLoadPercent: 74,
  },
  {
    id: "dev-tx-04",
    kind: "transformer",
    ratedCapacityKw: 1800,
    baselineLoadPercent: 77,
  },
  {
    id: "dev-fdr-18",
    kind: "feeder",
    ratedCapacityKw: 540,
    baselineLoadPercent: 0,
    offline: true,
  },
];

const env = loadRuntimeEnv();
const mqttConfig = createMqttConfig(env);
const baseTopic = normalizePublishBaseTopic(mqttConfig.topic);
const intervalMs = normalizeIntervalMs(env.MQTT_PUBLISH_INTERVAL_MS);
const client = mqtt.connect(mqttConfig.url, {
  clean: true,
  clientId: mqttConfig.clientId,
  connectTimeout: 10_000,
  password: mqttConfig.password,
  reconnectPeriod: 3_000,
  username: mqttConfig.username,
});

let tick = 0;
let timer;

client.on("connect", () => {
  console.log(`connected ${redactUrl(mqttConfig.url)}`);
  console.log(`publishing ${devices.length} devices every ${intervalMs}ms`);

  publishBatch();
  timer = setInterval(publishBatch, intervalMs);
});

client.on("reconnect", () => {
  console.log("reconnecting");
});

client.on("error", (error) => {
  console.error(`mqtt error: ${error.message}`);
});

client.on("close", () => {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function publishBatch() {
  tick += 1;
  const capturedAt = new Date().toISOString();
  let sample;

  for (const device of devices) {
    const reading = createReading(device, tick, capturedAt);
    const topic = topicForDevice(baseTopic, device.id);

    sample ??= reading;

    client.publish(topic, JSON.stringify(reading), { qos: 0 }, (error) => {
      if (error) {
        console.error(`publish error ${device.id}: ${error.message}`);
      }
    });
  }

  if (sample) {
    console.log(
      `published tick=${tick} sample=${sample.device_id} load=${sample.load_percent}% temp=${sample.temperature_c}C pf=${sample.power_factor}`,
    );
  }
}

function createReading(device, tickValue, capturedAt) {
  if (device.offline) {
    return {
      device_id: device.id,
      captured_at: capturedAt,
      voltage_v: 0,
      current_a: 0,
      active_power_kw: 0,
      reactive_power_kvar: 0,
      power_factor: 0,
      frequency_hz: 0,
      temperature_c: round(30 + wave(tickValue, device.id, 0.8, 0.2), 1),
      total_harmonic_distortion: 0,
      load_percent: 0,
    };
  }

  const loadPercent = clamp(
    device.baselineLoadPercent +
      wave(tickValue, device.id, 9, 0.45) +
      jitter(2.8),
    18,
    116,
  );
  const voltageBase = device.kind === "meter" ? 230 : device.kind === "inverter" ? 400 : 415;
  const stress = Math.max(0, loadPercent - 84);
  const voltageV = clamp(
    voltageBase - stress * 0.45 + jitter(3.5),
    voltageBase * 0.86,
    voltageBase * 1.08,
  );
  const activePowerKw = (device.ratedCapacityKw * loadPercent) / 100;
  const powerFactor = clamp(0.98 - loadPercent / 540 - stress / 420 + jitter(0.012), 0.74, 0.99);
  const currentA =
    device.kind === "meter"
      ? (activePowerKw * 1000) / Math.max(voltageV * powerFactor, 1)
      : (activePowerKw * 1000) / Math.max(1.732 * voltageV * powerFactor, 1);
  const reactivePowerKvar = activePowerKw * Math.tan(Math.acos(powerFactor));
  const temperatureC = clamp(28 + loadPercent * 0.35 + stress * 0.42 + jitter(1.4), 24, 96);
  const totalHarmonicDistortion = clamp(
    1.5 + loadPercent / 38 + (device.kind === "inverter" ? 1.2 : 0) + jitter(0.25),
    1.2,
    9.4,
  );

  return {
    device_id: device.id,
    captured_at: capturedAt,
    voltage_v: round(voltageV, 1),
    current_a: round(currentA, 1),
    active_power_kw: round(activePowerKw, 1),
    reactive_power_kvar: round(reactivePowerKvar, 1),
    power_factor: round(powerFactor, 3),
    frequency_hz: round(clamp(50 + jitter(0.04), 49.82, 50.12), 3),
    temperature_c: round(temperatureC, 1),
    total_harmonic_distortion: round(totalHarmonicDistortion, 2),
    load_percent: round(loadPercent, 1),
  };
}

function createMqttConfig(runtimeEnv) {
  try {
    return getMqttServerConfig(runtimeEnv, "gridstream-publisher");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function normalizeIntervalMs(value) {
  const interval = Number(value || 1500);

  return Number.isFinite(interval) && interval > 0 ? interval : 1500;
}

function normalizePublishBaseTopic(value) {
  return (value || "gridstream/telemetry/#")
    .trim()
    .replace(/\/[#+]$/, "")
    .replace(/\/$/, "");
}

function topicForDevice(baseTopicValue, deviceId) {
  return baseTopicValue ? `${baseTopicValue}/${deviceId}` : deviceId;
}

function wave(tickValue, seed, amplitude, speed) {
  const phase = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0);

  return Math.sin(tickValue * speed + phase) * amplitude;
}

function jitter(amount) {
  return (Math.random() * 2 - 1) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places) {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
}

function shutdown() {
  console.log("\nstopping publisher");

  if (timer) {
    clearInterval(timer);
  }

  client.end(false, () => process.exit(0));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
