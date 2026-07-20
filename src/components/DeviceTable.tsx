import { CircuitBoard, MapPin, ServerCog, Zap } from "lucide-react";
import { Badge } from "./Badge";
import type { Device, Site, TelemetryReading } from "../domain/types";

interface DeviceTableProps {
  devices: Device[];
  sites: Site[];
  readings: Record<string, TelemetryReading>;
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
}

export function DeviceTable({
  devices,
  sites,
  readings,
  selectedDeviceId,
  onSelectDevice,
}: DeviceTableProps) {
  const siteById = new Map(sites.map((site) => [site.id, site]));

  return (
    <section className="asset-list">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Assets</p>
          <h2>Device Fleet</h2>
        </div>
        <CircuitBoard aria-hidden="true" size={20} />
      </div>
      <div className="device-rows">
        {devices.map((device) => {
          const reading = readings[device.id];
          const site = siteById.get(device.siteId);

          return (
            <button
              className={`device-row ${
                selectedDeviceId === device.id ? "device-row-active" : ""
              }`}
              key={device.id}
              onClick={() => onSelectDevice(device.id)}
              type="button"
            >
              <span className="device-row-icon">
                {device.kind === "transformer" ? (
                  <ServerCog aria-hidden="true" size={18} />
                ) : (
                  <Zap aria-hidden="true" size={18} />
                )}
              </span>
              <span className="device-row-main">
                <strong>{device.name}</strong>
                <span>
                  <MapPin aria-hidden="true" size={13} />
                  {site?.region ?? "Unknown"}
                </span>
              </span>
              <span className="device-row-meta">
                <Badge tone={device.status} />
                <span>{Math.round(reading?.loadPercent ?? 0)}%</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
