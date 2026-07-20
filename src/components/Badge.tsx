import type {
  AlertStatus,
  DeviceStatus,
  Severity,
  TicketStatus,
} from "../domain/types";

type BadgeTone = Severity | AlertStatus | TicketStatus | DeviceStatus;

interface BadgeProps {
  tone: BadgeTone;
  label?: string;
}

export function Badge({ tone, label = tone }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{formatLabel(label)}</span>;
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}
