import { useCallback, useEffect, useMemo, useState } from "react";
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
  MaintenanceTicket,
  TelemetryReading,
  TelemetryStreamState,
  TicketStatus,
} from "../domain/types";

const ticketFlow: Record<TicketStatus, TicketStatus> = {
  open: "scheduled",
  scheduled: "in_progress",
  in_progress: "resolved",
  resolved: "resolved",
};

export function useTelemetryStream(intervalMs = 1_800) {
  const [state, setState] = useState<TelemetryStreamState>(() => ({
    tick: 0,
    devices,
    readings: initialReadings,
    history: initialHistory,
    alerts: initialAlerts,
    tickets: initialTickets,
    lastUpdated: new Date().toISOString(),
  }));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((current) => advanceTelemetryState(current));
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs]);

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

  return useMemo(
    () => ({
      ...state,
      organization,
      sites,
      alertRules,
      acknowledgeAlert,
      createTicketFromAlert,
      advanceTicket,
    }),
    [acknowledgeAlert, advanceTicket, createTicketFromAlert, state],
  );
}

function advanceTelemetryState(
  current: TelemetryStreamState,
): TelemetryStreamState {
  const capturedAt = new Date();
  const tick = current.tick + 1;
  const readings: Record<string, TelemetryReading> = {};
  const history: Record<string, TelemetryReading[]> = {};
  let alerts = [...current.alerts];

  for (const device of current.devices) {
    const previous = current.readings[device.id] ?? initialReadings[device.id];
    const reading = nextReading(device, previous, tick, capturedAt);
    const drafts = evaluateAlerts(reading, device, alertRules);
    const breachedRuleIds = new Set(drafts.map((draft) => draft.ruleId));

    readings[device.id] = reading;
    history[device.id] = [...(current.history[device.id] ?? []), reading].slice(
      -48,
    );

    alerts = alerts.map((alert) => {
      const recovered =
        alert.deviceId === device.id &&
        alert.status !== "resolved" &&
        !breachedRuleIds.has(alert.ruleId);

      return recovered
        ? { ...alert, status: "resolved", resolvedAt: reading.capturedAt }
        : alert;
    });

    const activeAlerts = alerts.filter(
      (alert) => alert.deviceId === device.id && alert.status !== "resolved",
    );
    const newAlerts: Alert[] = drafts
      .filter(
        (draft) =>
          !activeAlerts.some((alert) => alert.ruleId === draft.ruleId),
      )
      .map((draft, index) => ({
        ...draft,
        id: `alert-${draft.deviceId}-${draft.ruleId}-${tick}-${index}`,
        status: "open",
      }));

    alerts = [...newAlerts, ...alerts].slice(0, 80);
  }

  return {
    ...current,
    tick,
    readings,
    history,
    alerts,
    lastUpdated: capturedAt.toISOString(),
  };
}
