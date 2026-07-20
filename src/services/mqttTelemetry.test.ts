import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMqttWebSocketUrl,
  parseMqttTelemetryPayload,
} from "./mqttTelemetry";

test("parses snake_case MQTT telemetry records", () => {
  const updates = parseMqttTelemetryPayload(
    JSON.stringify({
      device_id: "dev-tx-01",
      captured_at: "2026-07-20T12:00:00Z",
      voltage_v: "410.5",
      current_a: 120.2,
      active_power_kw: 740,
      power_factor: 0.91,
      load_percent: 88.4,
      thd_percent: 4.9,
    }),
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0].deviceId, "dev-tx-01");
  assert.equal(updates[0].capturedAt, "2026-07-20T12:00:00.000Z");
  assert.equal(updates[0].metrics.voltageV, 410.5);
  assert.equal(updates[0].metrics.activePowerKw, 740);
  assert.equal(updates[0].metrics.totalHarmonicDistortion, 4.9);
});

test("parses batched MQTT readings", () => {
  const updates = parseMqttTelemetryPayload(
    JSON.stringify({
      readings: [
        { deviceId: "dev-a", loadPercent: 45 },
        { device_id: "dev-b", temperature_c: 71 },
      ],
    }),
  );

  assert.equal(updates.length, 2);
  assert.equal(updates[0].metrics.loadPercent, 45);
  assert.equal(updates[1].metrics.temperatureC, 71);
});

test("ignores MQTT records without device id or metrics", () => {
  const updates = parseMqttTelemetryPayload(
    JSON.stringify([{ deviceId: "dev-a" }, { loadPercent: 20 }, null]),
  );

  assert.equal(updates.length, 0);
});

test("normalizes MQTT broker URLs for browser WebSocket connections", () => {
  assert.equal(
    normalizeMqttWebSocketUrl("y4e1641e.ala.asia-southeast1.emqxsl.com"),
    "wss://y4e1641e.ala.asia-southeast1.emqxsl.com:8084/mqtt",
  );
  assert.equal(
    normalizeMqttWebSocketUrl("mqtt://broker.example.com:8084/mqtt"),
    "wss://broker.example.com:8084/mqtt",
  );
  assert.equal(
    normalizeMqttWebSocketUrl("wss://broker.example.com:8084/mqtt"),
    "wss://broker.example.com:8084/mqtt",
  );
});
