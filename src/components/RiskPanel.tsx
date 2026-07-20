import { Crosshair, Gauge, Zap } from "lucide-react";
import { Badge } from "./Badge";
import { formatMetricValue } from "../domain/telemetry";
import type { Device, DeviceRisk, TelemetryReading } from "../domain/types";

interface RiskPanelProps {
  risks: DeviceRisk[];
  devices: Device[];
  readings: Record<string, TelemetryReading>;
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
}

export function RiskPanel({
  risks,
  devices,
  readings,
  selectedDeviceId,
  onSelectDevice,
}: RiskPanelProps) {
  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const visibleRisks = risks.slice(0, 5);

  return (
    <section className="risk-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Dispatch</p>
          <h2>Risk Priority</h2>
        </div>
        <Crosshair aria-hidden="true" size={20} />
      </div>

      {visibleRisks.length === 0 ? (
        <div className="empty-state">No matching assets</div>
      ) : (
        <div className="risk-list">
          {visibleRisks.map((risk) => {
            const device = deviceById.get(risk.deviceId);
            const reading = readings[risk.deviceId];

            return (
              <button
                className={`risk-row ${
                  selectedDeviceId === risk.deviceId ? "risk-row-active" : ""
                }`}
                key={risk.deviceId}
                onClick={() => onSelectDevice(risk.deviceId)}
                type="button"
              >
                <span className={`risk-score risk-score-${risk.level}`}>
                  {risk.score}
                </span>
                <span className="risk-main">
                  <span className="risk-title">
                    <strong>{device?.name ?? "Unknown asset"}</strong>
                    <Badge tone={risk.level === "urgent" ? "critical" : risk.level === "watch" ? "warning" : "online"} label={risk.level} />
                  </span>
                  <span className="risk-metrics">
                    <span>
                      <Zap aria-hidden="true" size={13} />
                      {reading ? formatMetricValue(reading.loadPercent, "loadPercent") : "n/a"}
                    </span>
                    <span>
                      <Gauge aria-hidden="true" size={13} />
                      {reading ? formatMetricValue(reading.powerFactor, "powerFactor") : "n/a"}
                    </span>
                  </span>
                  <span className="risk-reasons">
                    {risk.reasons.map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
