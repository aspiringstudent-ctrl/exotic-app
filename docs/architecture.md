# Architecture

GridStream Ops is split into three layers:

1. Presentation: React components under `src/components`.
2. Domain: typed telemetry, alert, and aggregation logic under `src/domain`.
3. Data access: currently a simulator hook under `src/hooks`, designed to be replaced by Supabase Realtime or a WebSocket backend.

## Data Flow

The simulator produces a new reading for each device every interval. The dashboard aggregates those readings into fleet KPIs, evaluates alert rules, and renders the latest fleet state.

In production, an ingestion service should write validated readings into `telemetry_readings`. Supabase Realtime can publish inserts to the browser, while server-side jobs evaluate alert rules and create alerts.

## Security Model

The Supabase migration enables Row Level Security on tenant-scoped tables. Every organization-scoped read or write is checked against `org_memberships`, and user-owned operations are represented through `profiles`.

## Operational Notes

- Keep alert evaluation server-side for authoritative production behavior.
- Keep raw telemetry immutable; store derived state separately.
- Use retention jobs or partitioning for large telemetry volumes.
- Prefer service-role credentials only in trusted backend processes.
