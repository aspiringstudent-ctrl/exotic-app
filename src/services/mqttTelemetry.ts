import type { NumericTelemetryMetric } from "../domain/types";

export interface MqttTelemetryConfig {
  url: string;
  topic: string;
  username?: string;
  password?: string;
  clientId?: string;
}

export interface MqttTelemetryUpdate {
  deviceId: string;
  capturedAt?: string;
  metrics: Partial<Record<NumericTelemetryMetric, number>>;
}

export interface MqttTelemetryHandlers {
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (message: string) => void;
  onTelemetry: (updates: MqttTelemetryUpdate[]) => void;
}

const metricAliases: Record<NumericTelemetryMetric, string[]> = {
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

export function getMqttTelemetryConfig(): MqttTelemetryConfig | null {
  const url = import.meta.env.VITE_MQTT_URL?.trim() ?? "";
  const topic = import.meta.env.VITE_MQTT_TOPIC?.trim() ?? "";

  if (!url || !topic) {
    return null;
  }

  return {
    url: normalizeMqttWebSocketUrl(url),
    topic,
    username: normalizeOptionalEnv(import.meta.env.VITE_MQTT_USERNAME),
    password: normalizeOptionalEnv(import.meta.env.VITE_MQTT_PASSWORD),
    clientId: normalizeOptionalEnv(import.meta.env.VITE_MQTT_CLIENT_ID),
  };
}


export function parseMqttTelemetryPayload(payload: string): MqttTelemetryUpdate[] {
  const parsed = JSON.parse(payload) as unknown;
  const records = getPayloadRecords(parsed);

  return records
    .map(normalizeTelemetryRecord)
    .filter((update): update is MqttTelemetryUpdate => Boolean(update));
}

function getPayloadRecords(payload: unknown): unknown[] {
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

function normalizeTelemetryRecord(record: unknown): MqttTelemetryUpdate | null {
  if (!isRecord(record)) {
    return null;
  }

  const deviceId = getStringValue(record, ["deviceId", "device_id", "assetId", "asset_id"]);

  if (!deviceId) {
    return null;
  }

  const metrics: Partial<Record<NumericTelemetryMetric, number>> = {};

  for (const metric of Object.keys(metricAliases) as NumericTelemetryMetric[]) {
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

function normalizeTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const time = Date.parse(value);

  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function getStringValue(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getNumberValue(
  record: Record<string, unknown>,
  keys: string[],
): number | undefined {
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

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

function normalizeMqttWebSocketUrl(value: string): string {
  if (/^wss?:\/\//i.test(value)) {
    return value;
  }

  const trimmedValue = value.replace(/^\/+|\/+$/g, "");

  return `wss://${trimmedValue}:8084/mqtt`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
