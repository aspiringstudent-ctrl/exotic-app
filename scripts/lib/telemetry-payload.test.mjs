import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMqttWebSocketUrl } from "./runtime-config.mjs";
import { createTelemetryRows, parseTelemetryPayload } from "./telemetry-payload.mjs";

test("creates Supabase telemetry rows from full MQTT readings", () => {
  const updates = parseTelemetryPayload(
    JSON.stringify({
      device_id: "dev-tx-01",
      captured_at: "2026-07-21T10:00:00Z",
      voltage_v: 410.5,
      current_a: 120.2,
      active_power_kw: 740,
      reactive_power_kvar: 298.4,
      power_factor: 0.91,
      frequency_hz: 50.01,
      temperature_c: 63.5,
      total_harmonic_distortion: 4.9,
      load_percent: 88.4,
    }),
  );
  const devices = new Map([
    ["dev-tx-01", { id: "device-uuid", organizationId: "org-uuid" }],
  ]);
  const { rows, skipped } = createTelemetryRows(
    updates,
    devices,
    "2026-07-21T10:00:01.000Z",
  );

  assert.equal(skipped.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].organization_id, "org-uuid");
  assert.equal(rows[0].device_id, "device-uuid");
  assert.equal(rows[0].captured_at, "2026-07-21T10:00:00.000Z");
  assert.equal(rows[0].active_power_kw, 740);
  assert.equal(rows[0].total_harmonic_distortion, 4.9);
});

test("skips unknown devices and partial rows for database ingestion", () => {
  const updates = parseTelemetryPayload(
    JSON.stringify([
      { device_id: "unknown", voltage_v: 410.5, load_percent: 50 },
      { device_id: "dev-tx-01", load_percent: 88.4 },
    ]),
  );
  const devices = new Map([
    ["dev-tx-01", { id: "device-uuid", organizationId: "org-uuid" }],
  ]);
  const { rows, skipped } = createTelemetryRows(
    updates,
    devices,
    "2026-07-21T10:00:01.000Z",
  );

  assert.equal(rows.length, 0);
  assert.equal(skipped.length, 2);
  assert.equal(skipped[0].reason, "unknown_device");
  assert.equal(skipped[1].reason, "missing_metrics");
  assert.ok(skipped[1].metrics.includes("voltageV"));
});


test("normalizes server MQTT URLs", () => {
  assert.equal(
    normalizeMqttWebSocketUrl("mqtt://broker.example.com:8084/mqtt"),
    "wss://broker.example.com:8084/mqtt",
  );
  assert.equal(
    normalizeMqttWebSocketUrl("broker.example.com"),
    "wss://broker.example.com:8084/mqtt",
  );
});
