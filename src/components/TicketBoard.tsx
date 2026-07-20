import { ArrowRight, ClipboardList } from "lucide-react";
import { Badge } from "./Badge";
import type { Device, MaintenanceTicket } from "../domain/types";

interface TicketBoardProps {
  tickets: MaintenanceTicket[];
  devices: Device[];
  onAdvanceTicket: (ticketId: string) => void;
}

export function TicketBoard({
  tickets,
  devices,
  onAdvanceTicket,
}: TicketBoardProps) {
  const deviceById = new Map(devices.map((device) => [device.id, device]));

  return (
    <section className="ticket-board">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Work Orders</p>
          <h2>Maintenance Queue</h2>
        </div>
        <ClipboardList aria-hidden="true" size={20} />
      </div>
      <div className="ticket-grid">
        {tickets.map((ticket) => {
          const device = deviceById.get(ticket.deviceId);

          return (
            <article className="ticket-card" key={ticket.id}>
              <div className="event-row">
                <Badge tone={ticket.priority} />
                <Badge tone={ticket.status} />
              </div>
              <h3>{ticket.title}</h3>
              <dl>
                <div>
                  <dt>Asset</dt>
                  <dd>{device?.name ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Assignee</dt>
                  <dd>{ticket.assignee}</dd>
                </div>
                <div>
                  <dt>Due</dt>
                  <dd>{formatDateTime(ticket.dueAt)}</dd>
                </div>
              </dl>
              <button
                className="primary-button"
                disabled={ticket.status === "resolved"}
                onClick={() => onAdvanceTicket(ticket.id)}
                type="button"
              >
                <ArrowRight aria-hidden="true" size={16} />
                Advance
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
