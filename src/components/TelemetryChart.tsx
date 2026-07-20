import type { NumericTelemetryMetric, TelemetryReading } from "../domain/types";
import { formatMetricValue, getMetricLabel } from "../domain/telemetry";

interface TelemetryChartProps {
  readings: TelemetryReading[];
  metric: NumericTelemetryMetric;
}

export function TelemetryChart({ readings, metric }: TelemetryChartProps) {
  const values = readings.map((reading) => reading[metric]);
  const width = 720;
  const height = 220;
  const padding = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);

    return { x, y, value };
  });
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaString =
    points.length > 0
      ? `${padding},${height - padding} ${pointString} ${width - padding},${
          height - padding
        }`
      : "";
  const latestValue = values.length > 0 ? values[values.length - 1] : 0;

  return (
    <section className="chart-panel">
      <div className="chart-header">
        <div>
          <p className="eyebrow">Live trend</p>
          <h2>{getMetricLabel(metric)}</h2>
        </div>
        <strong>{formatMetricValue(latestValue, metric)}</strong>
      </div>
      <svg
        className="telemetry-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${getMetricLabel(metric)} trend`}
      >
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          className="chart-axis"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          className="chart-axis"
        />
        <polygon points={areaString} className="chart-area" />
        <polyline points={pointString} className="chart-line" />
        {points.map((point) => (
          <circle
            key={`${point.x}-${point.y}`}
            cx={point.x}
            cy={point.y}
            r="2.8"
            className="chart-dot"
          />
        ))}
      </svg>
      <div className="chart-range">
        <span>{formatMetricValue(min, metric)}</span>
        <span>{formatMetricValue(max, metric)}</span>
      </div>
    </section>
  );
}
