#!/usr/bin/env node
/* global console */
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import mqtt from "mqtt";
import {
  getMqttServerConfig,
  getSupabaseServerConfig,
  loadRuntimeEnv,
  redactUrl,
} from "./lib/runtime-config.mjs";
import { createTelemetryRows, parseTelemetryPayload } from "./lib/telemetry-payload.mjs";

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const env = loadRuntimeEnv();
  const supabaseConfig = getSupabaseServerConfig(env);
  const mqttConfig = getMqttServerConfig(env, "gridstream-ingestor");
  const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let devicesByExternalId = await loadDeviceCatalog(supabase);
  const client = mqtt.connect(mqttConfig.url, {
    clean: true,
    clientId: mqttConfig.clientId,
    connectTimeout: 10_000,
    password: mqttConfig.password,
    reconnectPeriod: 3_000,
    username: mqttConfig.username,
  });

  client.on("connect", () => {
    console.log(`connected ${redactUrl(mqttConfig.url)}`);
    console.log(`subscribing ${mqttConfig.topic}`);

    client.subscribe(mqttConfig.topic, { qos: 0 }, (error) => {
      if (error) {
        console.error(`subscribe error: ${error.message}`);
      }
    });
  });

  client.on("reconnect", () => {
    console.log("reconnecting");
  });

  client.on("error", (error) => {
    console.error(`mqtt error: ${error.message}`);
  });

  client.on("message", (topic, payload) => {
    void handleMessage(supabase, devicesByExternalId, topic, payload).then((result) => {
      if (result.refreshCatalog) {
        return loadDeviceCatalog(supabase).then((nextCatalog) => {
          devicesByExternalId = nextCatalog;
        });
      }

      return undefined;
    });
  });

  process.on("SIGINT", () => shutdown(client));
  process.on("SIGTERM", () => shutdown(client));
}

async function loadDeviceCatalog(supabase) {
  const { data, error } = await supabase
    .from("devices")
    .select("id, organization_id, external_id")
    .not("external_id", "is", null);

  if (error) {
    if (error.message?.includes("external_id")) {
      throw new Error(`${error.message}. Run supabase/migrations/0002_mqtt_ingestion_support.sql before ingesting.`);
    }

    throw error;
  }

  const catalog = new Map();

  for (const device of data ?? []) {
    if (device.external_id) {
      catalog.set(device.external_id, {
        id: device.id,
        organizationId: device.organization_id,
      });
    }
  }

  console.log(`loaded ${catalog.size} Supabase devices with external_id`);

  if (catalog.size === 0) {
    console.log("run npm run supabase:seed before ingesting demo MQTT data");
  }

  return catalog;
}

async function handleMessage(supabase, devicesByExternalId, topic, payload) {
  let updates;

  try {
    updates = parseTelemetryPayload(payload);
  } catch (error) {
    console.error(`invalid telemetry payload on ${topic}: ${error instanceof Error ? error.message : error}`);
    return { refreshCatalog: false };
  }

  if (updates.length === 0) {
    return { refreshCatalog: false };
  }

  const { rows, skipped } = createTelemetryRows(
    updates,
    devicesByExternalId,
    new Date().toISOString(),
  );

  if (skipped.length > 0) {
    logSkipped(skipped);
  }

  if (rows.length === 0) {
    return { refreshCatalog: skipped.some((item) => item.reason === "unknown_device") };
  }

  const { error } = await supabase.from("telemetry_readings").insert(rows);

  if (error) {
    console.error(`supabase insert error: ${error.message}`);
    return { refreshCatalog: false };
  }

  console.log(`inserted ${rows.length} telemetry rows from ${topic}`);

  return { refreshCatalog: skipped.some((item) => item.reason === "unknown_device") };
}

function logSkipped(skipped) {
  const summary = new Map();

  for (const item of skipped) {
    summary.set(item.reason, (summary.get(item.reason) ?? 0) + 1);
  }

  console.log(
    `skipped ${skipped.length} telemetry records: ${Array.from(summary.entries())
      .map(([reason, count]) => `${reason}=${count}`)
      .join(" ")}`,
  );
}

function shutdown(client) {
  console.log("stopping ingestor");
  client.end(false, () => process.exit(0));
}
