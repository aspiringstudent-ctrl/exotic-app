import { Download, Pause, Play, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { DeviceKind, DeviceStatus, Site } from "../domain/types";

export type DeviceStatusFilter = DeviceStatus | "all";
export type DeviceKindFilter = DeviceKind | "all";
export type SiteFilter = string | "all";

interface CommandBarProps {
  query: string;
  statusFilter: DeviceStatusFilter;
  kindFilter: DeviceKindFilter;
  siteFilter: SiteFilter;
  sites: Site[];
  paused: boolean;
  visibleCount: number;
  totalCount: number;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: DeviceStatusFilter) => void;
  onKindFilterChange: (kind: DeviceKindFilter) => void;
  onSiteFilterChange: (siteId: SiteFilter) => void;
  onTogglePaused: () => void;
  onReset: () => void;
  onExport: () => void;
}

const statusOptions: Array<{ value: DeviceStatusFilter; label: string }> = [
  { value: "all", label: "All status" },
  { value: "online", label: "Online" },
  { value: "attention", label: "Attention" },
  { value: "offline", label: "Offline" },
];

const kindOptions: Array<{ value: DeviceKindFilter; label: string }> = [
  { value: "all", label: "All assets" },
  { value: "transformer", label: "Transformers" },
  { value: "feeder", label: "Feeders" },
  { value: "meter", label: "Meters" },
  { value: "inverter", label: "Inverters" },
];

export function CommandBar({
  query,
  statusFilter,
  kindFilter,
  siteFilter,
  sites,
  paused,
  visibleCount,
  totalCount,
  onQueryChange,
  onStatusFilterChange,
  onKindFilterChange,
  onSiteFilterChange,
  onTogglePaused,
  onReset,
  onExport,
}: CommandBarProps) {
  return (
    <section className="command-bar" aria-label="Fleet controls">
      <label className="search-control">
        <Search aria-hidden="true" size={17} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search assets, sites, tags"
          type="search"
        />
      </label>

      <div className="filter-group">
        <SlidersHorizontal aria-hidden="true" size={17} />
        <select
          aria-label="Status filter"
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as DeviceStatusFilter)
          }
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Asset type filter"
          value={kindFilter}
          onChange={(event) =>
            onKindFilterChange(event.target.value as DeviceKindFilter)
          }
        >
          {kindOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Site filter"
          value={siteFilter}
          onChange={(event) => onSiteFilterChange(event.target.value)}
        >
          <option value="all">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>

      <div className="command-actions">
        <span className="command-count">
          {visibleCount}/{totalCount} assets
        </span>
        <button
          className="icon-button"
          onClick={onTogglePaused}
          title={paused ? "Resume stream" : "Pause stream"}
          type="button"
        >
          {paused ? <Play aria-hidden="true" size={16} /> : <Pause aria-hidden="true" size={16} />}
          <span>{paused ? "Resume" : "Pause"}</span>
        </button>
        <button className="icon-button" onClick={onExport} title="Export CSV" type="button">
          <Download aria-hidden="true" size={16} />
          <span>Export</span>
        </button>
        <button className="icon-button" onClick={onReset} title="Reset workspace" type="button">
          <RotateCcw aria-hidden="true" size={16} />
          <span>Reset</span>
        </button>
      </div>
    </section>
  );
}
