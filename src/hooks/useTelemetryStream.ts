import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  alertRules,
  devices,
  initialAlerts,
  initialHistory,
  initialReadings,
  initialTickets,
  organization,
  sites,
} from "../data/seed";
import { evaluateAlerts, nextReading } from "../domain/telemetry";
import type {
  Alert,
  Device,
  MaintenanceTicket,
  TelemetryReading,
  TelemetrySourceStatus,
  TelemetryStreamState,
  TicketStatus,
} from "../domain/types";
import {
  getMqttTelemetryConfig,
  type MqttTelemetryConfig,
  type MqttTelemetryUpdate,
} from "../services/mqttTelemetry";

const STORAGE_KEY = "gridstream-ops-state-v2";
const MQTT_STALE_AFTER_MS = 5_000;

const ticketFlow: Record<TicketStatus, TicketStatus> = {
  open: "scheduled",
  scheduled: "in_progress",
  in_progress: "resolved",
  resolved: "resolved",
};

interface PersistedOpsState {
  alerts: Alert[];
  tickets: MaintenanceTicket[];
}

export function useTelemetryStream(intervalMs = 1_800) {
  const mqttConfig = useMemo(() => getMqttTelemetryConfig(), []);
  const lastMqttMessageAtRef = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [source, setSource] = useState<TelemetrySourceStatus>(() =>
    createInitialSourceStatus(mqttConfig),
  );
  const [state, setState] = useState<TelemetryStreamState>(() =>
    createInitialStreamState(loadPersistedOpsState()),
  );

  useEffect(() => {
    if (mqttConfig || paused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setState((current) => advanceTelemetryState(current));
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, mqttConfig, paused]);

  useEffect(() => {
    if (!mqttConfig) {
      setSource({ mode: "simulator", state: paused ? "disconnected" : "simulated" });
      return undefined;
    }

    if (paused) {
      setSource({
        mode: "mqtt",
        state: "disconnected",
        topic: mqttConfig.topic,
        error: "Stream paused",
      });
      return undefined;
    }

    lastMqttMessageAtRef.current = Date.now();
    setSource({ mode: "mqtt", state: "connecting", topic: mqttConfig.topic });

    let disconnect: (() => void) | undefined;
    let cancelled = false;

    void import("../services/mqttClient")
      .then(({ connectMqttTelemetry }) => {
        if (cancelled) {
          return;
        }

        disconnect = connectMqttTelemetry(mqttConfig, {
          onConnected: () => {
            setSource({ mode: "mqtt", state: "connected", topic: mqttConfig.topic });
          },
          onDisconnected: () => {
            setSource((current) => ({
              ...current,
              mode: "mqtt",
              state: current.state === "error" ? "error" : "disconnected",
              topic: mqttConfig.topic,
            }));
          },
          onError: (message) => {
            setSource((current) => ({
              ...current,
              mode: "mqtt",
              state: "error",
              topic: mqttConfig.topic,
              error: message,
            }));
          },
          onTelemetry: (updates) => {
            const receivedAt = new Date().toISOString();

            if (!hasKnownTelemetryDevice(updates)) {
              setSource({
                mode: "mqtt",
                state: "stale",
                topic: mqttConfig.topic,
                error: "MQTT telemetry received for unknown device IDs; simulator fallback active",
              });
              return;
            }

            lastMqttMessageAtRef.current = Date.now();
            setState((current) =>
              applyMqttTelemetryUpdates(current, updates, receivedAt),
            );
            setSource({
              mode: "mqtt",
              state: "connected",
              topic: mqttConfig.topic,
              lastMessageAt: receivedAt,
            });
          },
        });
      })
      .catch((error: unknown) => {
        setSource({
          mode: "mqtt",
          state: "error",
          topic: mqttConfig.topic,
          error: error instanceof Error ? error.message : "Unable to load MQTT client",
        });
      });

    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [mqttConfig, paused]);

  useEffect(() => {
    if (!mqttConfig || paused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const lastMessageAt = lastMqttMessageAtRef.current;
      const isStale =
        !lastMessageAt || Date.now() - lastMessageAt > MQTT_STALE_AFTER_MS;

      if (!isStale) {
        return;
      }

      setState((current) => advanceTelemetryState(current));
      setSource((current) => ({
        ...current,
        mode: "mqtt",
        state: "stale",
        topic: mqttConfig.topic,
        error: "No MQTT telemetry received; simulator fallback active",
      }));
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, mqttConfig, paused]);

  useEffect(() => {
    persistOpsState({ alerts: state.alerts, tickets: state.tickets });
  }, [state.alerts, state.tickets]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    const timestamp = new Date().toISOString();

    setState((current) => ({
      ...current,
      alerts: current.alerts.map((alert) =>
        alert.id === alertId && alert.status === "open"
          ? { ...alert, status: "acknowledged", acknowledgedAt: timestamp }
          : alert,
      ),
    }));
  }, []);

  const createTicketFromAlert = useCallback((alert: Alert) => {
    const timestamp = new Date().toISOString();

    setState((current) => {
      const existingTicket = current.tickets.some(
        (ticket) => ticket.alertId === alert.id,
      );

      if (existingTicket) {
        return current;
      }

      const ticket: MaintenanceTicket = {
        id: `ticket-${alert.id}`,
        organizationId: alert.organizationId,
        deviceId: alert.deviceId,
        alertId: alert.id,
        status: "open",
        priority: alert.severity,
        title: `Investigate ${alert.title.toLowerCase()}`,
        assignee: "Unassigned",
        dueAt: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
        updatedAt: timestamp,
      };

      return {
        ...current,
        tickets: [ticket, ...current.tickets],
      };
    });
  }, []);

  const advanceTicket = useCallback((ticketId: string) => {
    const timestamp = new Date().toISOString();

    setState((current) => ({
      ...current,
      tickets: current.tickets.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              status: ticketFlow[ticket.status],
              updatedAt: timestamp,
            }
          : ticket,
      ),
    }));
  }, []);

  const togglePaused = useCallback(() => {
    setPaused((current) => !current);
  }, []);

  const resetWorkspace = useCallback(() => {
    clearPersistedOpsState();
    lastMqttMessageAtRef.current = null;
    setPaused(false);
    setSource(createInitialSourceStatus(mqttConfig));
    setState(createInitialStreamState());
  }, [mqttConfig]);

  return useMemo(
    () => ({
      ...state,
      organization,
      sites,
      alertRules,
      paused,
      source,
      acknowledgeAlert,
      createTicketFromAlert,
      advanceTicket,
      togglePaused,
      resetWorkspace,
    }),
    [
      acknowledgeAlert,
      advanceTicket,
      createTicketFromAlert,
      paused,
      resetWorkspace,
      source,
      state,
      togglePaused,
    ],
  );
}

function createInitialSourceStatus(
  mqttConfig: MqttTelemetryConfig | null,
): TelemetrySourceStatus {
  return mqttConfig
    ? { mode: "mqtt", state: "connecting", topic: mqttConfig.topic }
    : { mode: "simulator", state: "simulated" };
}

function createInitialStreamState(
  opsState?: PersistedOpsState,
): TelemetryStreamState {
  return {
    tick: 0,
    devices,
    readings: initialReadings,
    history: initialHistory,
    alerts: opsState?.alerts ?? initialAlerts,
    tickets: opsState?.tickets ?? initialTickets,
    lastUpdated: new Date().toISOString(),
  };
}

function advanceTelemetryState(
  current: TelemetryStreamState,
): TelemetryStreamState {
  const capturedAt = new Date();
  const tick = current.tick + 1;
  let nextState: TelemetryStreamState = {
    ...current,
    tick,
    readings: { ...current.readings },
    history: { ...current.history },
    alerts: [...current.alerts],
    lastUpdated: capturedAt.toISOString(),
  };

  for (const device of current.devices) {
    const previous = current.readings[device.id] ?? initialReadings[device.id];
    const reading = nextReading(device, previous, tick, capturedAt);
    nextState = applyTelemetryReading(nextState, device, reading, tick);
  }

  return nextState;
}

function hasKnownTelemetryDevice(updates: MqttTelemetryUpdate[]): boolean {
  const knownDeviceIds = new Set(devices.map((device) => device.id));

  return updates.some((update) => knownDeviceIds.has(update.deviceId));
}

function applyMqttTelemetryUpdates(
  current: TelemetryStreamState,
  updates: MqttTelemetryUpdate[],
  receivedAt: string,
): TelemetryStreamState {
  const tick = current.tick + 1;
  let nextState: TelemetryStreamState = {
    ...current,
    tick,
    readings: { ...current.readings },
    history: { ...current.history },
    alerts: [...current.alerts],
    lastUpdated: receivedAt,
  };

  updates.forEach((update, index) => {
    const device = current.devices.find((item) => item.id === update.deviceId);

    if (!device) {
      return;
    }

    const previous = current.readings[device.id] ?? initialReadings[device.id];
    const reading: TelemetryReading = {
      ...previous,
      ...update.metrics,
      id: `${device.id}-mqtt-${tick}-${index}`,
      capturedAt: update.capturedAt ?? receivedAt,
      deviceId: device.id,
    };

    nextState = applyTelemetryReading(nextState, device, reading, tick);
  });

  return nextState;
}

function applyTelemetryReading(
  current: TelemetryStreamState,
  device: Device,
  reading: TelemetryReading,
  tick: number,
): TelemetryStreamState {
  const drafts = evaluateAlerts(reading, device, alertRules);
  const breachedRuleIds = new Set(drafts.map((draft) => draft.ruleId));
  let alerts = current.alerts.map((alert) => {
    const recovered =
      alert.deviceId === device.id &&
      alert.status !== "resolved" &&
      !breachedRuleIds.has(alert.ruleId);

    return recovered
      ? { ...alert, status: "resolved" as const, resolvedAt: reading.capturedAt }
      : alert;
  });
  const activeAlerts = alerts.filter(
    (alert) => alert.deviceId === device.id && alert.status !== "resolved",
  );
  const newAlerts: Alert[] = drafts
    .filter(
      (draft) => !activeAlerts.some((alert) => alert.ruleId === draft.ruleId),
    )
    .map((draft, index) => ({
      ...draft,
      id: `alert-${draft.deviceId}-${draft.ruleId}-${tick}-${index}`,
      status: "open",
    }));

  alerts = [...newAlerts, ...alerts].slice(0, 80);

  return {
    ...current,
    readings: {
      ...current.readings,
      [device.id]: reading,
    },
    history: {
      ...current.history,
      [device.id]: [...(current.history[device.id] ?? []), reading].slice(-48),
    },
    alerts,
  };
}

function loadPersistedOpsState(): PersistedOpsState | undefined {
  const storage = getLocalStorage();

  if (!storage) {
    return undefined;
  }

  try {
    const rawState = storage.getItem(STORAGE_KEY);

    if (!rawState) {
      return undefined;
    }

    const parsed = JSON.parse(rawState) as Partial<PersistedOpsState>;

    if (!Array.isArray(parsed.alerts) || !Array.isArray(parsed.tickets)) {
      return undefined;
    }

    return {
      alerts: parsed.alerts,
      tickets: parsed.tickets,
    };
  } catch {
    return undefined;
  }
}

function persistOpsState(state: PersistedOpsState): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quotas or private-mode restrictions should not break telemetry.
  }
}

function clearPersistedOpsState(): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing persisted demo state is best-effort.
  }
}

function getLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
