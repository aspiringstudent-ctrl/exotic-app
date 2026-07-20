import { CheckCheck, TriangleAlert, Wrench } from "lucide-react";
import { Badge } from "./Badge";
import type { Alert, Device, MaintenanceTicket } from "../domain/types";

interface AlertCenterProps {
  alerts: Alert[];
  devices: Device[];
  tickets: MaintenanceTicket[];
  onAcknowledge: (alertId: string) => void;
  onCreateTicket: (alert: Alert) => void;
}

export function AlertCenter({
  alerts,
  devices,
  tickets,
  onAcknowledge,
  onCreateTicket,
}: AlertCenterProps) {
  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const ticketAlertIds = new Set(
    tickets.map((ticket) => ticket.alertId).filter(Boolean),
  );
  const visibleAlerts = alerts.slice(0, 10);

  return (
    <section className="event-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Events</p>
          <h2>Alert Center</h2>
        </div>
        <TriangleAlert aria-hidden="true" size={20} />
      </div>
      <div className="event-list">
        {visibleAlerts.map((alert) => {
          const device = deviceById.get(alert.deviceId);
          const hasTicket = ticketAlertIds.has(alert.id);

          return (
            <article className="event-item" key={alert.id}>
              <div className="event-row">
                <Badge tone={alert.severity} />
                <Badge tone={alert.status} />
              </div>
              <h3>{alert.title}</h3>
              <p>{alert.message}</p>
              <div className="event-footer">
                <span>{device?.name ?? "Unknown asset"}</span>
                <span>{timeAgo(alert.triggeredAt)}</span>
              </div>
              <div className="action-row">
                <button
                  className="secondary-button"
                  disabled={alert.status !== "open"}
                  onClick={() => onAcknowledge(alert.id)}
                  type="button"
                >
                  <CheckCheck aria-hidden="true" size={16} />
                  Acknowledge
                </button>
                <button
                  className="secondary-button"
                  disabled={hasTicket}
                  onClick={() => onCreateTicket(alert)}
                  type="button"
                >
                  <Wrench aria-hidden="true" size={16} />
                  Ticket
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function timeAgo(value: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.round(minutes / 60)}h ago`;
}
