export const requiredMetrics = [
  "voltageV",
  "currentA",
  "activePowerKw",
  "reactivePowerKvar",
  "powerFactor",
  "frequencyHz",
  "temperatureC",
  "totalHarmonicDistortion",
  "loadPercent",
];

const metricAliases = {
  voltageV: ["voltageV", "voltage_v", "voltage"],
  currentA: ["currentA", "current_a", "current"],
  activePowerKw: ["activePowerKw", "active_power_kw", "active_kw", "powerKw", "power_kw"],
  reactivePowerKvar: ["reactivePowerKvar", "reactive_power_kvar", "reactive_kvar"],
  powerFactor: ["powerFactor", "power_factor", "pf"],
  frequencyHz: ["frequencyHz", "frequency_hz", "frequency"],
  temperatureC: ["temperatureC", "temperature_c", "temperature"],
  totalHarmonicDistortion: [
    "totalHarmonicDistortion",
    "total_harmonic_distortion",
    "thd",
    "thd_percent",
  ],
  loadPercent: ["loadPercent", "load_percent", "load"],
};

const databaseColumns = {
  voltageV: "voltage_v",
  currentA: "current_a",
  activePowerKw: "active_power_kw",
  reactivePowerKvar: "reactive_power_kvar",
  powerFactor: "power_factor",
  frequencyHz: "frequency_hz",
  temperatureC: "temperature_c",
  totalHarmonicDistortion: "total_harmonic_distortion",
  loadPercent: "load_percent",
};

export function parseTelemetryPayload(payload) {
  const parsed = JSON.parse(typeof payload === "string" ? payload : payload.toString());
  const records = getPayloadRecords(parsed);

  return records
    .map(normalizeTelemetryRecord)
    .filter((update) => Boolean(update));
}

export function createTelemetryRows(updates, devicesByExternalId, receivedAt) {
  const rows = [];
  const skipped = [];

  for (const update of updates) {
    const device = devicesByExternalId.get(update.deviceId);

    if (!device) {
      skipped.push({ deviceId: update.deviceId, reason: "unknown_device" });
      continue;
    }

    const missingMetrics = requiredMetrics.filter(
      (metric) => !Number.isFinite(update.metrics[metric]),
    );

    if (missingMetrics.length > 0) {
      skipped.push({
        deviceId: update.deviceId,
        reason: "missing_metrics",
        metrics: missingMetrics,
      });
      continue;
    }

    const row = {
      organization_id: device.organizationId,
      device_id: device.id,
      captured_at: update.capturedAt ?? receivedAt,
    };

    for (const metric of requiredMetrics) {
      row[databaseColumns[metric]] = update.metrics[metric];
    }

    rows.push(row);
  }

  return { rows, skipped };
}

function getPayloadRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.readings)) {
    return payload.readings;
  }

  if (isRecord(payload) && Array.isArray(payload.devices)) {
    return payload.devices;
  }

  return [payload];
}

function normalizeTelemetryRecord(record) {
  if (!isRecord(record)) {
    return null;
  }

  const deviceId = getStringValue(record, ["deviceId", "device_id", "assetId", "asset_id"]);

  if (!deviceId) {
    return null;
  }

  const metrics = {};

  for (const metric of Object.keys(metricAliases)) {
    const value = getNumberValue(record, metricAliases[metric]);

    if (value !== undefined) {
      metrics[metric] = value;
    }
  }

  if (Object.keys(metrics).length === 0) {
    return null;
  }

  return {
    deviceId,
    capturedAt: normalizeTimestamp(
      getStringValue(record, ["capturedAt", "captured_at", "timestamp", "time"]),
    ),
    metrics,
  };
}

function normalizeTimestamp(value) {
  if (!value) {
    return undefined;
  }

  const time = Date.parse(value);

  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function getStringValue(record, keys) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getNumberValue(record, keys) {
  for (const key of keys) {
    const value = record[key];
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return undefined;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}
