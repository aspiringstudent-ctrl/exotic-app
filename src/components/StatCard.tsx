import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger";
}

export function StatCard({
  label,
  value,
  helper,
  icon,
  tone = "neutral",
}: StatCardProps) {
  return (
    <section className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-icon">{icon}</div>
      <div>
        <p className="eyebrow">{label}</p>
        <strong>{value}</strong>
        <span>{helper}</span>
      </div>
    </section>
  );
}
