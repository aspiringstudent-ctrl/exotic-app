import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFleetSummary,
  compareMetric,
  createInitialReading,
  evaluateAlerts,
  nextReading,
} from "./telemetry";
import type { AlertRule, Device } from "./types";

const device: Device = {
  id: "dev-test",
  organizationId: "org-test",
  siteId: "site-test",
  name: "Test Transformer",
  serialNumber: "TEST-001",
  kind: "transformer",
  status: "online",
  ratedCapacityKw: 1000,
  baselineLoadPercent: 75,
  commissionedAt: "2024-01-01",
  firmwareVersion: "1.0.0",
  tags: ["test"],
};

test("compares metric values against rule operators", () => {
  assert.equal(compareMetric(95, ">=", 92), true);
  assert.equal(compareMetric(0.84, "<", 0.86), true);
  assert.equal(compareMetric(50, ">", 50), false);
});

test("generates bounded next readings", () => {
  const initial = createInitialReading(device, new Date("2026-01-01T00:00:00Z"));
  const reading = nextReading(
    device,
    initial,
    4,
    new Date("2026-01-01T00:01:00Z"),
  );

  assert.ok(reading.activePowerKw > 0);
  assert.ok(reading.powerFactor >= 0.73);
  assert.ok(reading.frequencyHz >= 49.82);
  assert.ok(reading.frequencyHz <= 50.12);
});

test("creates alert drafts when enabled rules are breached", () => {
  const rules: AlertRule[] = [
    {
      id: "rule-load",
      organizationId: "org-test",
      name: "Load high",
      metric: "loadPercent",
      operator: ">=",
      threshold: 80,
      severity: "critical",
      enabled: true,
    },
  ];
  const reading = {
    ...createInitialReading(device),
    loadPercent: 87,
  };

  const alerts = evaluateAlerts(reading, device, rules);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].deviceId, device.id);
  assert.equal(alerts[0].severity, "critical");
});

test("summarizes fleet health from live readings and alerts", () => {
  const reading = createInitialReading(device);
  const summary = calculateFleetSummary(
    [device],
    { [device.id]: reading },
    [
      {
        id: "alert-test",
        organizationId: "org-test",
        deviceId: device.id,
        ruleId: "rule-load",
        severity: "critical",
        status: "open",
        title: "Load high",
        message: "Load high",
        metric: "loadPercent",
        value: 92,
        threshold: 90,
        triggeredAt: reading.capturedAt,
      },
    ],
  );

  assert.equal(summary.totalDevices, 1);
  assert.equal(summary.activeCriticalAlerts, 1);
  assert.ok(summary.activeLoadKw > 0);
});
