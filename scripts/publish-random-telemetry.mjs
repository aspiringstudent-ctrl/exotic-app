#!/usr/bin/env node
/* global clearInterval, console, setInterval */
import fs from "node:fs";
import process from "node:process";
import mqtt from "mqtt";

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

const env = loadEnvFile(".env.local");
const mqttUrl = normalizeMqttUrl(env.VITE_MQTT_URL);
const baseTopic = (env.VITE_MQTT_TOPIC || "gridstream/telemetry/#")
  .replace(/\/#$/, "")
  .replace(/\/\+$/, "")
  .replace(/\/$/, "");
const intervalMs = Number(process.env.MQTT_PUBLISH_INTERVAL_MS || 1500);

if (!mqttUrl) {
  fail("VITE_MQTT_URL is missing in .env.local");
}

const client = mqtt.connect(mqttUrl, {
  clean: true,
  clientId: `${env.VITE_MQTT_CLIENT_ID || "gridstream-publisher"}-${randomId()}`,
  connectTimeout: 10_000,
  password: optional(env.VITE_MQTT_PASSWORD),
  reconnectPeriod: 3_000,
  username: optional(env.VITE_MQTT_USERNAME),
});

let tick = 0;
let timer;

client.on("connect", () => {
  console.log(`connected ${redactUrl(mqttUrl)}`);
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

  for (const device of devices) {
    const reading = createReading(device, tick, capturedAt);
    const topic = `${baseTopic}/${device.id}`;

    client.publish(topic, JSON.stringify(reading), { qos: 0 }, (error) => {
      if (error) {
        console.error(`publish error ${device.id}: ${error.message}`);
      }
    });
  }

  const sample = createReading(devices[0], tick, capturedAt);
  console.log(
    `published tick=${tick} sample=${sample.device_id} load=${sample.load_percent}% temp=${sample.temperature_c}C pf=${sample.power_factor}`,
  );
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

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        return [key, value];
      }),
  );
}

function normalizeMqttUrl(value) {
  const url = value?.trim();

  if (!url) {
    return "";
  }

  if (/^wss?:\/\//i.test(url)) {
    return url;
  }

  return `wss://${url.replace(/^\/+|\/+$/g, "")}:8084/mqtt`;
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

function optional(value) {
  return value?.trim() || undefined;
}

function randomId() {
  return Math.random().toString(16).slice(2, 8);
}

function redactUrl(value) {
  return value.replace(/:\/\/([^@]+)@/, "://<redacted>@");
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
