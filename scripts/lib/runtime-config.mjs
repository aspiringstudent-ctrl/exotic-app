import fs from "node:fs";
import process from "node:process";

export function loadRuntimeEnv(paths = [".env", ".env.local"]) {
  const fileEnv = {};

  for (const path of paths) {
    Object.assign(fileEnv, loadEnvFile(path));
  }

  return { ...fileEnv, ...process.env };
}

export function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
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
      })
      .filter(([key]) => key),
  );
}

export function optional(value) {
  return value?.trim() || undefined;
}

export function required(value, name) {
  const normalized = optional(value);

  if (!normalized) {
    throw new Error(`${name} is required`);
  }

  return normalized;
}

export function getSupabaseServerConfig(env) {
  return {
    url: required(env.SUPABASE_URL || env.VITE_SUPABASE_URL, "SUPABASE_URL"),
    serviceRoleKey: required(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getMqttServerConfig(env, clientIdPrefix) {
  const url = normalizeMqttWebSocketUrl(env.MQTT_URL || env.VITE_MQTT_URL || "");
  const topic = optional(env.MQTT_TOPIC || env.VITE_MQTT_TOPIC);

  if (!url) {
    throw new Error("MQTT_URL or VITE_MQTT_URL is required");
  }

  if (!topic) {
    throw new Error("MQTT_TOPIC or VITE_MQTT_TOPIC is required");
  }

  const configuredClientId = optional(env.MQTT_CLIENT_ID || env.VITE_MQTT_CLIENT_ID);

  return {
    url,
    topic,
    username: optional(env.MQTT_USERNAME || env.VITE_MQTT_USERNAME),
    password: optional(env.MQTT_PASSWORD || env.VITE_MQTT_PASSWORD),
    clientId: `${configuredClientId ?? clientIdPrefix}-${randomId()}`,
  };
}

export function normalizeMqttWebSocketUrl(value) {
  const trimmedValue = value.trim();

  if (/^wss?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  const brokerPath = trimmedValue
    .replace(/^(mqtts?|tcp):\/\//i, "")
    .replace(/^\/+|\/+$/g, "");

  if (!brokerPath) {
    return "";
  }

  if (brokerPath.includes("/")) {
    return `wss://${brokerPath}`;
  }

  return `wss://${brokerPath}${/:[0-9]+$/.test(brokerPath) ? "" : ":8084"}/mqtt`;
}

export function redactUrl(value) {
  return value.replace(/:\/\/([^@]+)@/, "://<redacted>@");
}

function randomId() {
  return Math.random().toString(16).slice(2, 10);
}
