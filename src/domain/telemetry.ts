import type {
  Alert,
  AlertDraft,
  AlertRule,
  ComparisonOperator,
  Device,
  DeviceRisk,
  FleetSummary,
  NumericTelemetryMetric,
  RiskLevel,
  TelemetryReading,
} from "./types";

const SQRT_THREE = 1.732;

const metricLabels: Record<NumericTelemetryMetric, string> = {
  voltageV: "Voltage",
  currentA: "Current",
  activePowerKw: "Load",
  reactivePowerKvar: "Reactive",
  powerFactor: "Power factor",
  frequencyHz: "Frequency",
  temperatureC: "Temperature",
  totalHarmonicDistortion: "THD",
  loadPercent: "Load percent",
};

const metricUnits: Record<NumericTelemetryMetric, string> = {
  voltageV: "V",
  currentA: "A",
  activePowerKw: "kW",
  reactivePowerKvar: "kVAR",
  powerFactor: "",
  frequencyHz: "Hz",
  temperatureC: "C",
  totalHarmonicDistortion: "%",
  loadPercent: "%",
};

const nominalVoltageByKind: Record<Device["kind"], number> = {
  transformer: 415,
  feeder: 415,
  meter: 230,
  inverter: 400,
};

export function getMetricLabel(metric: NumericTelemetryMetric): string {
  return metricLabels[metric];
}

export function getMetricUnit(metric: NumericTelemetryMetric): string {
  return metricUnits[metric];
}

export function formatMetricValue(
  value: number,
  metric: NumericTelemetryMetric,
): string {
  const unit = getMetricUnit(metric);

  if (metric === "powerFactor") {
    return value.toFixed(2);
  }

  if (metric === "activePowerKw" || metric === "reactivePowerKvar") {
    return `${Math.round(value).toLocaleString()} ${unit}`;
  }

  if (metric === "frequencyHz") {
    return `${value.toFixed(2)} ${unit}`;
  }

  return `${value.toFixed(1)} ${unit}`;
}

export function compareMetric(
  value: number,
  operator: ComparisonOperator,
  threshold: number,
): boolean {
  switch (operator) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
  }
}

export function createInitialReading(
  device: Device,
  capturedAt = new Date(),
): TelemetryReading {
  return readingFromLoad(device, device.baselineLoadPercent, 0, capturedAt);
}

export function nextReading(
  device: Device,
  previous: TelemetryReading,
  tick: number,
  capturedAt = new Date(),
): TelemetryReading {
  if (device.status === "offline") {
    return {
      ...previous,
      id: `${device.id}-${tick}`,
      capturedAt: capturedAt.toISOString(),
      currentA: 0,
      activePowerKw: 0,
      reactivePowerKvar: 0,
      temperatureC: Math.max(22, previous.temperatureC - 0.8),
      loadPercent: 0,
    };
  }

  const devicePhase = numericHash(device.id) % 360;
  const slowWave = Math.sin((tick + devicePhase) / 5) * 7.5;
  const fastWave = Math.sin((tick * 1.7 + devicePhase) / 2.8) * 3.2;
  const attentionLift = device.status === "attention" ? 11 : 0;
  const loadPercent = clamp(
    device.baselineLoadPercent + slowWave + fastWave + attentionLift,
    8,
    118,
  );

  return readingFromLoad(device, loadPercent, tick, capturedAt);
}

export function backfillHistory(
  device: Device,
  points = 32,
  endDate = new Date(),
): TelemetryReading[] {
  const intervalMs = 60_000;
  const readings: TelemetryReading[] = [];
  let previous = createInitialReading(
    device,
    new Date(endDate.getTime() - points * intervalMs),
  );

  for (let index = 0; index < points; index += 1) {
    const capturedAt = new Date(endDate.getTime() - (points - index) * intervalMs);
    previous = nextReading(device, previous, index, capturedAt);
    readings.push(previous);
  }

  return readings;
}

export function evaluateAlerts(
  reading: TelemetryReading,
  device: Device,
  rules: AlertRule[],
): AlertDraft[] {
  return rules
    .filter((rule) => rule.enabled)
    .filter((rule) =>
      compareMetric(reading[rule.metric], rule.operator, rule.threshold),
    )
    .map((rule) => ({
      organizationId: device.organizationId,
      deviceId: device.id,
      ruleId: rule.id,
      severity: rule.severity,
      title: rule.name,
      message: `${device.name} ${getMetricLabel(rule.metric).toLowerCase()} is ${formatMetricValue(
        reading[rule.metric],
        rule.metric,
      )}`,
      metric: rule.metric,
      value: reading[rule.metric],
      threshold: rule.threshold,
      triggeredAt: reading.capturedAt,
    }));
}

export function calculateFleetSummary(
  devices: Device[],
  readings: Record<string, TelemetryReading>,
  alerts: Alert[],
): FleetSummary {
  const liveReadings = devices
    .map((device) => readings[device.id])
    .filter(Boolean);

  const activeCriticalAlerts = alerts.filter(
    (alert) => alert.status !== "resolved" && alert.severity === "critical",
  ).length;

  const activeLoadKw = sum(liveReadings.map((reading) => reading.activePowerKw));
  const averageLoadPercent = average(
    liveReadings.map((reading) => reading.loadPercent),
  );
  const averagePowerFactor = average(
    liveReadings.map((reading) => reading.powerFactor),
  );
  const peakTemperatureC = Math.max(
    0,
    ...liveReadings.map((reading) => reading.temperatureC),
  );

  return {
    totalDevices: devices.length,
    onlineDevices: devices.filter((device) => device.status === "online").length,
    attentionDevices: devices.filter((device) => device.status === "attention")
      .length,
    offlineDevices: devices.filter((device) => device.status === "offline").length,
    activeCriticalAlerts,
    activeLoadKw,
    averageLoadPercent,
    averagePowerFactor,
    peakTemperatureC,
  };
}

export function calculateDeviceRisk(
  device: Device,
  reading: TelemetryReading | undefined,
  alerts: Alert[],
): DeviceRisk {
  const activeAlerts = alerts.filter(
    (alert) => alert.deviceId === device.id && alert.status !== "resolved",
  );
  const criticalAlerts = activeAlerts.filter(
    (alert) => alert.severity === "critical",
  ).length;
  const warningAlerts = activeAlerts.filter(
    (alert) => alert.severity === "warning",
  ).length;
  const reasons: string[] = [];
  let score = 0;

  if (device.status === "offline") {
    score += 44;
    reasons.push("Offline asset");
  } else if (device.status === "attention") {
    score += 24;
    reasons.push("Attention status");
  }

  if (criticalAlerts > 0) {
    score += 38 + Math.min(12, (criticalAlerts - 1) * 4);
    reasons.push(`${criticalAlerts} critical ${pluralize("alert", criticalAlerts)}`);
  }

  if (warningAlerts > 0) {
    score += 16 + Math.min(10, (warningAlerts - 1) * 3);
    reasons.push(`${warningAlerts} warning ${pluralize("alert", warningAlerts)}`);
  }

  if (!reading) {
    score += 30;
    reasons.push("No live reading");

    const finalScore = normalizeRiskScore(score);

    return {
      deviceId: device.id,
      score: finalScore,
      level: riskLevelFromScore(finalScore),
      reasons: reasons.slice(0, 4),
    };
  }

  score += Math.max(0, reading.loadPercent - 72) * 0.62;
  score += Math.max(0, reading.temperatureC - 54) * 0.88;
  score += Math.max(0, 0.9 - reading.powerFactor) * 120;
  score += Math.max(0, reading.totalHarmonicDistortion - 3.8) * 4.8;

  if (reading.loadPercent >= 92) {
    reasons.push(`Load ${formatMetricValue(reading.loadPercent, "loadPercent")}`);
  } else if (reading.loadPercent >= 84) {
    reasons.push("Elevated load");
  }

  if (reading.temperatureC >= 68) {
    reasons.push(`Temperature ${formatMetricValue(reading.temperatureC, "temperatureC")}`);
  } else if (reading.temperatureC >= 60) {
    reasons.push("Temperature rising");
  }

  if (reading.powerFactor < 0.86) {
    reasons.push(`Power factor ${formatMetricValue(reading.powerFactor, "powerFactor")}`);
  }

  if (reading.totalHarmonicDistortion >= 5.2) {
    reasons.push(`THD ${formatMetricValue(reading.totalHarmonicDistortion, "totalHarmonicDistortion")}`);
  }

  const finalScore = normalizeRiskScore(score);

  return {
    deviceId: device.id,
    score: finalScore,
    level: riskLevelFromScore(finalScore),
    reasons: reasons.length > 0 ? Array.from(new Set(reasons)).slice(0, 4) : ["Nominal telemetry"],
  };
}

export function rankDevicesByRisk(
  devices: Device[],
  readings: Record<string, TelemetryReading>,
  alerts: Alert[],
): DeviceRisk[] {
  return devices
    .map((device) => calculateDeviceRisk(device, readings[device.id], alerts))
    .sort((left, right) => right.score - left.score || left.deviceId.localeCompare(right.deviceId));
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) {
    return "urgent";
  }

  if (score >= 35) {
    return "watch";
  }

  return "normal";
}

function normalizeRiskScore(score: number): number {
  return Math.round(clamp(score, 0, 100));
}

function pluralize(value: string, count: number): string {
  return count === 1 ? value : `${value}s`;
}

function readingFromLoad(
  device: Device,
  loadPercent: number,
  tick: number,
  capturedAt: Date,
): TelemetryReading {
  const voltageBase = nominalVoltageByKind[device.kind];
  const phase = numericHash(device.serialNumber) % 47;
  const stress = Math.max(0, loadPercent - 84);
  const voltageDip = stress * 0.42;
  const voltageNoise = Math.sin((tick + phase) / 4) * 3.8;
  const voltageV = clamp(voltageBase + voltageNoise - voltageDip, voltageBase * 0.86, voltageBase * 1.08);
  const activePowerKw = (device.ratedCapacityKw * loadPercent) / 100;
  const powerFactor = clamp(0.98 - loadPercent / 520 - stress / 380, 0.73, 0.99);
  const currentA =
    device.kind === "meter"
      ? (activePowerKw * 1000) / Math.max(voltageV * powerFactor, 1)
      : (activePowerKw * 1000) / Math.max(SQRT_THREE * voltageV * powerFactor, 1);
  const reactivePowerKvar = activePowerKw * Math.tan(Math.acos(powerFactor));
  const frequencyHz = clamp(50 + Math.sin((tick + phase) / 8) * 0.045, 49.82, 50.12);
  const temperatureC = clamp(28 + loadPercent * 0.34 + stress * 0.38, 24, 96);
  const totalHarmonicDistortion = clamp(
    1.7 + loadPercent / 38 + (device.kind === "inverter" ? 1.1 : 0),
    1.2,
    8.8,
  );

  return {
    id: `${device.id}-${tick}`,
    deviceId: device.id,
    capturedAt: capturedAt.toISOString(),
    voltageV: round(voltageV, 1),
    currentA: round(currentA, 1),
    activePowerKw: round(activePowerKw, 1),
    reactivePowerKvar: round(reactivePowerKvar, 1),
    powerFactor: round(powerFactor, 3),
    frequencyHz: round(frequencyHz, 3),
    temperatureC: round(temperatureC, 1),
    totalHarmonicDistortion: round(totalHarmonicDistortion, 2),
    loadPercent: round(loadPercent, 1),
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function numericHash(value: string): number {
  return value.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
