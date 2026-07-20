# Architecture

GridStream Ops is split into four layers:

1. Presentation: React components under `src/components`.
2. Domain: typed telemetry, alert, aggregation, and risk logic under `src/domain`.
3. Data source adapters: simulator and MQTT browser adapter under `src/hooks` and `src/services`.
4. Platform access: Supabase client and authentication state under `src/lib` and `src/hooks`.

## Data Flow

When no MQTT broker is configured, the simulator produces a new reading for each device every interval. The dashboard aggregates those readings into fleet KPIs, evaluates alert rules, ranks device risk, and renders the latest fleet state.

When `VITE_MQTT_URL` and `VITE_MQTT_TOPIC` are configured, the browser connects to the broker over WebSockets and subscribes to the configured topic. MQTT payloads are normalized into partial telemetry updates, merged with the previous device reading, appended to local history, and passed through the same alert-resolution path as simulated readings.

In production, a trusted ingestion service should validate MQTT payloads, write immutable readings into `telemetry_readings`, and publish sanitized realtime events to the browser. Direct browser MQTT is useful for pilots and controlled demos, but broker credentials are public once shipped to the client.

## Authentication

Supabase authentication is optional in local demo mode and enforced when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present. The app supports email/password sign-in, password sign-up, magic links, session restore, and sign-out.

The migration creates a `profiles` row automatically when a Supabase Auth user is created. Tenant-scoped data remains guarded by Row Level Security policies that check `org_memberships`.

## Security Model

The Supabase migration enables Row Level Security on tenant-scoped tables. Every organization-scoped read or write is checked against `org_memberships`, and user-owned operations are represented through `profiles`.

MQTT browser credentials must be scoped to non-destructive subscribe-only topics. For production control planes, issue short-lived broker credentials from a trusted backend after Supabase auth, and keep service-role credentials only in backend processes.

## Operational Notes

- Keep alert evaluation server-side for authoritative production behavior.
- Keep raw telemetry immutable; store derived state separately.
- Use retention jobs or partitioning for large telemetry volumes.
- Treat MQTT messages as untrusted input and validate them before persistence.
- Prefer service-role credentials only in trusted backend processes.
