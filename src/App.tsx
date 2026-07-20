import {
  Activity,
  Bell,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  RadioTower,
  ShieldCheck,
  Thermometer,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AlertCenter } from "./components/AlertCenter";
import { Badge } from "./components/Badge";
import { DeviceTable } from "./components/DeviceTable";
import { StatCard } from "./components/StatCard";
import { TelemetryChart } from "./components/TelemetryChart";
import { TicketBoard } from "./components/TicketBoard";
import { calculateFleetSummary, formatMetricValue } from "./domain/telemetry";
import type { NumericTelemetryMetric } from "./domain/types";
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
  const stream = useTelemetryStream();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selectedDeviceId, setSelectedDeviceId] = useState(stream.devices[0].id);
  const [selectedMetric, setSelectedMetric] =
    useState<NumericTelemetryMetric>("activePowerKw");

  const selectedDevice =
    stream.devices.find((device) => device.id === selectedDeviceId) ??
    stream.devices[0];
  const selectedReading = stream.readings[selectedDevice.id];
  const selectedHistory = stream.history[selectedDevice.id] ?? [];
  const summary = useMemo(
    () =>
      calculateFleetSummary(stream.devices, stream.readings, stream.alerts),
    [stream.alerts, stream.devices, stream.readings],
  );
  const activeAlerts = stream.alerts.filter(
    (alert) => alert.status !== "resolved",
  );

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
            <strong>Streaming</strong>
            <span>{stream.devices.length} assets connected</span>
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
            <span>Updated {formatClock(stream.lastUpdated)}</span>
          </div>
        </header>

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
              devices={stream.devices}
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
            <AlertCenter
              alerts={stream.alerts}
              devices={stream.devices}
              tickets={stream.tickets}
              onAcknowledge={stream.acknowledgeAlert}
              onCreateTicket={stream.createTicketFromAlert}
            />
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

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
