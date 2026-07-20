import mqtt, { type IClientOptions, type MqttClient } from "mqtt";
import {
  parseMqttTelemetryPayload,
  type MqttTelemetryConfig,
  type MqttTelemetryHandlers,
} from "./mqttTelemetry";

export function connectMqttTelemetry(
  config: MqttTelemetryConfig,
  handlers: MqttTelemetryHandlers,
): () => void {
  const options: IClientOptions = {
    clean: true,
    clientId: config.clientId ?? createClientId(),
    connectTimeout: 10_000,
    password: config.password,
    reconnectPeriod: 3_000,
    username: config.username,
  };
  const client: MqttClient = mqtt.connect(config.url, options);

  client.on("connect", () => {
    handlers.onConnected();
    client.subscribe(config.topic, { qos: 0 }, (error) => {
      if (error) {
        handlers.onError(error.message);
      }
    });
  });

  client.on("message", (_topic, payload) => {
    try {
      const updates = parseMqttTelemetryPayload(payload.toString());

      if (updates.length > 0) {
        handlers.onTelemetry(updates);
      }
    } catch (error) {
      handlers.onError(error instanceof Error ? error.message : "Invalid MQTT telemetry payload");
    }
  });

  client.on("offline", handlers.onDisconnected);
  client.on("close", handlers.onDisconnected);
  client.on("error", (error) => {
    handlers.onError(error.message);
  });

  return () => {
    client.end(true);
  };
}

function createClientId(): string {
  const suffix = Math.random().toString(16).slice(2, 10);

  return `gridstream-ops-${suffix}`;
}
