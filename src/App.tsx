import {
  Activity,
  Bell,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LogOut,
  RadioTower,
  ShieldCheck,
  Thermometer,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertCenter } from "./components/AlertCenter";
import { AuthGate, type AuthContextView } from "./components/AuthGate";
import { Badge } from "./components/Badge";
import {
  CommandBar,
  type DeviceKindFilter,
  type DeviceStatusFilter,
  type SiteFilter,
} from "./components/CommandBar";
import { DeviceTable } from "./components/DeviceTable";
import { RiskPanel } from "./components/RiskPanel";
import { StatCard } from "./components/StatCard";
import { TelemetryChart } from "./components/TelemetryChart";
import { TicketBoard } from "./components/TicketBoard";
import {
  calculateFleetSummary,
  formatMetricValue,
  rankDevicesByRisk,
} from "./domain/telemetry";
import type {
  Device,
  DeviceRisk,
  NumericTelemetryMetric,
  Site,
  TelemetryReading,
  TelemetrySourceState,
} from "./domain/types";
import { useTelemetryStream } from "./hooks/useTelemetryStream";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "tickets", label: "Tickets", icon: ClipboardList },
] as const;

const metricOptions: Array<{
  metric: NumericTelemetryMetric;
  label: string;
}> = [
  { metric: "activePowerKw", label: "Load" },
  { metric: "voltageV", label: "Voltage" },
  { metric: "temperatureC", label: "Temp" },
  { metric: "powerFactor", label: "PF" },
];

type TabId = (typeof tabs)[number]["id"];

const numberFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 0,
});

export default function App() {
  return (
    <AuthGate>
      {(auth) => <OperationsDashboard auth={auth} />}
    </AuthGate>
  );
}

function OperationsDashboard({ auth }: { auth: AuthContextView }) {
  const stream = useTelemetryStream();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selectedDeviceId, setSelectedDeviceId] = useState(stream.devices[0].id);
  const [selectedMetric, setSelectedMetric] =
    useState<NumericTelemetryMetric>("activePowerKw");
  const [deviceQuery, setDeviceQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<DeviceStatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<DeviceKindFilter>("all");
  const [siteFilter, setSiteFilter] = useState<SiteFilter>("all");

  const summary = useMemo(
    () =>
      calculateFleetSummary(stream.devices, stream.readings, stream.alerts),
    [stream.alerts, stream.devices, stream.readings],
  );
  const deviceRisks = useMemo(
    () => rankDevicesByRisk(stream.devices, stream.readings, stream.alerts),
    [stream.alerts, stream.devices, stream.readings],
  );
  const filteredDevices = useMemo(
    () =>
      filterDevices(stream.devices, stream.sites, {
        query: deviceQuery,
        status: statusFilter,
        kind: kindFilter,
        siteId: siteFilter,
      }),
    [deviceQuery, kindFilter, siteFilter, statusFilter, stream.devices, stream.sites],
  );

  useEffect(() => {
    if (
      filteredDevices.length > 0 &&
      !filteredDevices.some((device) => device.id === selectedDeviceId)
    ) {
      setSelectedDeviceId(filteredDevices[0].id);
    }
  }, [filteredDevices, selectedDeviceId]);

  const selectedDevice =
    filteredDevices.find((device) => device.id === selectedDeviceId) ??
    filteredDevices[0] ??
    stream.devices.find((device) => device.id === selectedDeviceId) ??
    stream.devices[0];
  const selectedReading = stream.readings[selectedDevice.id];
  const selectedHistory = stream.history[selectedDevice.id] ?? [];
  const selectedRisk = deviceRisks.find(
    (risk) => risk.deviceId === selectedDevice.id,
  );
  const activeAlerts = stream.alerts.filter(
    (alert) => alert.status !== "resolved",
  );
  const filteredDeviceIds = new Set(filteredDevices.map((device) => device.id));
  const visibleRisks = deviceRisks.filter((risk) =>
    filteredDeviceIds.has(risk.deviceId),
  );
  const urgentRiskCount = deviceRisks.filter(
    (risk) => risk.level === "urgent",
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Zap aria-hidden="true" size={20} />
          </span>
          <div>
            <strong>GridStream</strong>
            <span>Ops</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                className={activeTab === tab.id ? "nav-item nav-item-active" : "nav-item"}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-status">
          <RadioTower aria-hidden="true" size={18} />
          <div>
            <strong>{sourceLabel(stream.source.state)}</strong>
            <span>{stream.source.topic ?? `${stream.devices.length} assets connected`}</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{stream.organization.name}</p>
            <h1>Electrical Operations</h1>
          </div>
          <div className="topbar-meta">
            <Badge tone={activeAlerts.length > 0 ? "warning" : "online"} label={`${activeAlerts.length} active alerts`} />
            <Badge tone={sourceTone(stream.source.state)} label={`${stream.source.mode}: ${stream.source.state}`} />
            {stream.paused ? <Badge tone="info" label="stream paused" /> : null}
            {stream.source.error ? <span className="source-error" title={stream.source.error}>{stream.source.error}</span> : null}
            <span>{auth.email}</span>
            <span>Updated {formatClock(stream.lastUpdated)}</span>
            <button className="secondary-button" onClick={auth.onSignOut} type="button">
              <LogOut aria-hidden="true" size={16} />
              {auth.mode === "demo" ? "Exit demo" : "Sign out"}
            </button>
          </div>
        </header>

        <CommandBar
          kindFilter={kindFilter}
          paused={stream.paused}
          query={deviceQuery}
          siteFilter={siteFilter}
          sites={stream.sites}
          statusFilter={statusFilter}
          totalCount={stream.devices.length}
          visibleCount={filteredDevices.length}
          onExport={() =>
            exportTelemetrySnapshot(
              stream.devices,
              stream.sites,
              stream.readings,
              deviceRisks,
            )
          }
          onKindFilterChange={setKindFilter}
          onQueryChange={setDeviceQuery}
          onReset={stream.resetWorkspace}
          onSiteFilterChange={setSiteFilter}
          onStatusFilterChange={setStatusFilter}
          onTogglePaused={stream.togglePaused}
        />

        <section className="stat-grid" aria-label="Fleet statistics">
          <StatCard
            helper={`${summary.onlineDevices}/${summary.totalDevices} online`}
            icon={<Activity aria-hidden="true" size={20} />}
            label="Fleet Load"
            tone="good"
            value={`${numberFormatter.format(summary.activeLoadKw)} kW`}
          />
          <StatCard
            helper={`${summary.averageLoadPercent.toFixed(1)}% average load`}
            icon={<Gauge aria-hidden="true" size={20} />}
            label="Utilization"
            value={`${summary.averagePowerFactor.toFixed(2)} PF`}
          />
          <StatCard
            helper={`${summary.attentionDevices} assets need attention`}
            icon={<Bell aria-hidden="true" size={20} />}
            label="Critical Alerts"
            tone={summary.activeCriticalAlerts > 0 ? "danger" : "good"}
            value={String(summary.activeCriticalAlerts)}
          />
          <StatCard
            helper={`${visibleRisks.filter((risk) => risk.level !== "normal").length} in current view`}
            icon={<ClipboardList aria-hidden="true" size={20} />}
            label="Risk Queue"
            tone={urgentRiskCount > 0 ? "danger" : "neutral"}
            value={`${urgentRiskCount} urgent`}
          />
          <StatCard
            helper="Fleet high-water mark"
            icon={<Thermometer aria-hidden="true" size={20} />}
            label="Peak Temp"
            tone={summary.peakTemperatureC >= 68 ? "warning" : "neutral"}
            value={`${summary.peakTemperatureC.toFixed(1)} C`}
          />
        </section>

        {activeTab === "overview" ? (
          <section className="overview-layout">
            <DeviceTable
              deviceRisks={deviceRisks}
              devices={filteredDevices}
              readings={stream.readings}
              selectedDeviceId={selectedDevice.id}
              sites={stream.sites}
              onSelectDevice={setSelectedDeviceId}
            />
            <section className="device-detail">
              <div className="device-detail-header">
                <div>
                  <p className="eyebrow">{selectedDevice.serialNumber}</p>
                  <h2>{selectedDevice.name}</h2>
                </div>
                <div className="device-badges">
                  <Badge tone={selectedDevice.status} />
                  <Badge tone="info" label={selectedDevice.kind} />
                  {selectedRisk ? (
                    <Badge
                      tone={selectedRisk.level === "urgent" ? "critical" : selectedRisk.level === "watch" ? "warning" : "online"}
                      label={`${selectedRisk.level} risk`}
                    />
                  ) : null}
                </div>
              </div>

              <div className="segmented-control" aria-label="Telemetry metric">
                {metricOptions.map((option) => (
                  <button
                    className={
                      selectedMetric === option.metric ? "segment-active" : ""
                    }
                    key={option.metric}
                    onClick={() => setSelectedMetric(option.metric)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <TelemetryChart metric={selectedMetric} readings={selectedHistory} />

              {selectedRisk ? (
                <div className="insight-strip">
                  <div>
                    <span>Risk score</span>
                    <strong>{selectedRisk.score}</strong>
                  </div>
                  {selectedRisk.reasons.map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                </div>
              ) : null}

              <div className="metric-grid">
                {selectedReading
                  ? metricOptions.concat([
                      { metric: "currentA", label: "Current" },
                      { metric: "frequencyHz", label: "Frequency" },
                      { metric: "totalHarmonicDistortion", label: "THD" },
                      { metric: "loadPercent", label: "Load %" },
                    ]).map((item) => (
                      <div className="metric-tile" key={item.metric}>
                        <span>{item.label}</span>
                        <strong>
                          {formatMetricValue(selectedReading[item.metric], item.metric)}
                        </strong>
                      </div>
                    ))
                  : null}
              </div>

              <div className="tag-row">
                <ShieldCheck aria-hidden="true" size={16} />
                {selectedDevice.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </section>
            <aside className="side-stack">
              <RiskPanel
                devices={stream.devices}
                readings={stream.readings}
                risks={visibleRisks}
                selectedDeviceId={selectedDevice.id}
                onSelectDevice={setSelectedDeviceId}
              />
              <AlertCenter
                alerts={stream.alerts}
                devices={stream.devices}
                limit={5}
                tickets={stream.tickets}
                onAcknowledge={stream.acknowledgeAlert}
                onCreateTicket={stream.createTicketFromAlert}
              />
            </aside>
          </section>
        ) : null}

        {activeTab === "alerts" ? (
          <AlertCenter
            alerts={stream.alerts}
            devices={stream.devices}
            tickets={stream.tickets}
            onAcknowledge={stream.acknowledgeAlert}
            onCreateTicket={stream.createTicketFromAlert}
          />
        ) : null}

        {activeTab === "tickets" ? (
          <TicketBoard
            devices={stream.devices}
            tickets={stream.tickets}
            onAdvanceTicket={stream.advanceTicket}
          />
        ) : null}
      </main>
    </div>
  );
}

function filterDevices(
  devices: Device[],
  sites: Site[],
  filters: {
    query: string;
    status: DeviceStatusFilter;
    kind: DeviceKindFilter;
    siteId: SiteFilter;
  },
): Device[] {
  const siteById = new Map(sites.map((site) => [site.id, site]));
  const query = filters.query.trim().toLowerCase();

  return devices.filter((device) => {
    const site = siteById.get(device.siteId);
    const matchesStatus =
      filters.status === "all" || device.status === filters.status;
    const matchesKind = filters.kind === "all" || device.kind === filters.kind;
    const matchesSite = filters.siteId === "all" || device.siteId === filters.siteId;
    const searchableText = [
      device.name,
      device.serialNumber,
      device.kind,
      device.status,
      site?.name,
      site?.region,
      ...device.tags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      matchesStatus &&
      matchesKind &&
      matchesSite &&
      (query.length === 0 || searchableText.includes(query))
    );
  });
}

function exportTelemetrySnapshot(
  devices: Device[],
  sites: Site[],
  readings: Record<string, TelemetryReading>,
  risks: DeviceRisk[],
): void {
  const siteById = new Map(sites.map((site) => [site.id, site]));
  const riskById = new Map(risks.map((risk) => [risk.deviceId, risk]));
  const headers = [
    "asset",
    "serial",
    "kind",
    "status",
    "site",
    "load_percent",
    "temperature_c",
    "power_factor",
    "thd_percent",
    "risk_score",
    "risk_level",
    "captured_at",
  ];
  const rows = devices.map((device) => {
    const reading = readings[device.id];
    const risk = riskById.get(device.id);
    const site = siteById.get(device.siteId);

    return [
      device.name,
      device.serialNumber,
      device.kind,
      device.status,
      site?.name ?? "Unknown",
      reading?.loadPercent ?? "",
      reading?.temperatureC ?? "",
      reading?.powerFactor ?? "",
      reading?.totalHarmonicDistortion ?? "",
      risk?.score ?? "",
      risk?.level ?? "",
      reading?.capturedAt ?? "",
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const timestamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-");

  anchor.href = url;
  anchor.download = `gridstream-snapshot-${timestamp}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);

  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function sourceTone(state: TelemetrySourceState): "info" | "online" | "warning" | "critical" {
  if (state === "connected" || state === "simulated") {
    return "online";
  }

  if (state === "connecting" || state === "disconnected" || state === "stale") {
    return "warning";
  }

  return "critical";
}

function sourceLabel(state: TelemetrySourceState): string {
  switch (state) {
    case "simulated":
      return "Simulator";
    case "connecting":
      return "Connecting";
    case "connected":
      return "MQTT Live";
    case "stale":
      return "MQTT Stale";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Source Error";
  }
}
