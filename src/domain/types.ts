export type DeviceKind = "transformer" | "feeder" | "meter" | "inverter";
export type DeviceStatus = "online" | "attention" | "offline";
export type Severity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type TicketStatus = "open" | "scheduled" | "in_progress" | "resolved";
export type MemberRole = "owner" | "operator" | "viewer";
export type ComparisonOperator = ">" | ">=" | "<" | "<=";

export type NumericTelemetryMetric =
  | "voltageV"
  | "currentA"
  | "activePowerKw"
  | "reactivePowerKvar"
  | "powerFactor"
  | "frequencyHz"
  | "temperatureC"
  | "totalHarmonicDistortion"
  | "loadPercent";

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Site {
  id: string;
  organizationId: string;
  name: string;
  region: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface Device {
  id: string;
  organizationId: string;
  siteId: string;
  name: string;
  serialNumber: string;
  kind: DeviceKind;
  status: DeviceStatus;
  ratedCapacityKw: number;
  baselineLoadPercent: number;
  commissionedAt: string;
  firmwareVersion: string;
  tags: string[];
}

export interface TelemetryReading {
  id: string;
  deviceId: string;
  capturedAt: string;
  voltageV: number;
  currentA: number;
  activePowerKw: number;
  reactivePowerKvar: number;
  powerFactor: number;
  frequencyHz: number;
  temperatureC: number;
  totalHarmonicDistortion: number;
  loadPercent: number;
}

export interface AlertRule {
  id: string;
  organizationId: string;
  name: string;
  metric: NumericTelemetryMetric;
  operator: ComparisonOperator;
  threshold: number;
  severity: Severity;
  enabled: boolean;
}

export interface Alert {
  id: string;
  organizationId: string;
  deviceId: string;
  ruleId: string;
  severity: Severity;
  status: AlertStatus;
  title: string;
  message: string;
  metric: NumericTelemetryMetric;
  value: number;
  threshold: number;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface AlertDraft {
  organizationId: string;
  deviceId: string;
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  metric: NumericTelemetryMetric;
  value: number;
  threshold: number;
  triggeredAt: string;
}

export interface MaintenanceTicket {
  id: string;
  organizationId: string;
  deviceId: string;
  alertId?: string;
  status: TicketStatus;
  priority: Severity;
  title: string;
  assignee: string;
  dueAt: string;
  updatedAt: string;
}

export interface FleetSummary {
  totalDevices: number;
  onlineDevices: number;
  attentionDevices: number;
  offlineDevices: number;
  activeCriticalAlerts: number;
  activeLoadKw: number;
  averageLoadPercent: number;
  averagePowerFactor: number;
  peakTemperatureC: number;
}

export interface TelemetryStreamState {
  tick: number;
  devices: Device[];
  readings: Record<string, TelemetryReading>;
  history: Record<string, TelemetryReading[]>;
  alerts: Alert[];
  tickets: MaintenanceTicket[];
  lastUpdated: string;
}
