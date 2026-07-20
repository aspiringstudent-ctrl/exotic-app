# GridStream Ops

GridStream Ops is a production-shaped electrical telemetry dashboard for monitoring transformers, feeders, meters, and distributed energy assets. It supports a deterministic simulator for local demos, Supabase authentication for production access, and MQTT-over-WebSocket telemetry ingestion for live device streams.

For a deeper engineering and operations guide, see [docs/project-documentation.md](docs/project-documentation.md).

## What Is Included

- React + TypeScript + Vite app
- Supabase email/password, sign-up, sign-out, and magic-link authentication
- MQTT-over-WebSocket telemetry source with simulator fallback
- Live telemetry for voltage, current, load, temperature, harmonics, and power factor
- Fleet KPIs, device detail panel, sparkline trends, alert feed, and maintenance tickets
- Operator cockpit controls for search, filters, pause/resume, reset, and CSV export
- Risk-ranked dispatch panel that prioritizes stressed assets from alerts and telemetry
- Persisted local operator actions for demo acknowledgements and ticket workflow
- Typed domain logic with unit tests
- Supabase migration with profiles, organizations, memberships, devices, readings, alert rules, alerts, tickets, audit logs, RLS policies, and an auth profile trigger
- Docker, CI, lint, typecheck, and test scripts

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. If Supabase env vars are blank, the app shows a local demo access screen and uses simulated telemetry.

## Environment

Create `.env.local` from `.env.example`.

```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"

VITE_MQTT_URL="wss://broker.example.com:8084/mqtt"
VITE_MQTT_TOPIC="gridstream/telemetry/#"
VITE_MQTT_USERNAME="optional-browser-scoped-user"
VITE_MQTT_PASSWORD="optional-browser-scoped-password"
VITE_MQTT_CLIENT_ID="optional-client-id"
```

MQTT credentials in Vite are public browser credentials. Use broker ACLs, short-lived credentials, or a backend token exchange before connecting real production assets.

## MQTT Payload

The browser client accepts a single JSON record, an array of records, or an object with a `readings` array. CamelCase and snake_case metric names are both accepted.

```json
{
  "device_id": "dev-tx-01",
  "captured_at": "2026-07-20T12:00:00Z",
  "voltage_v": 410.5,
  "current_a": 120.2,
  "active_power_kw": 740,
  "power_factor": 0.91,
  "load_percent": 88.4,
  "thd_percent": 4.9
}
```

Known device IDs come from `src/data/seed.ts` until the device catalog is loaded from Supabase. Unknown device messages are ignored by the UI.

## Random MQTT Publisher

Use the included publisher to send randomized telemetry for every seeded device to the broker configured in `.env.local`. Run it in a second terminal while the Vite app is open.

```bash
npm run mqtt:publish
```

The script publishes one JSON message per known device every 1.5 seconds. Override the interval when needed:

```bash
MQTT_PUBLISH_INTERVAL_MS=750 npm run mqtt:publish
```

## Quality Gates

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Production Path

1. Create a Supabase project.
2. Run `supabase/migrations/0001_initial_schema.sql`.
3. Enable the email auth providers you want in Supabase Auth.
4. Add Supabase and MQTT env vars to `.env.local` or your host environment.
5. Configure MQTT broker WebSocket access and topic ACLs for browser clients.
6. Move authoritative alert evaluation and ticket mutation writes server-side before connecting critical infrastructure.
7. Deploy the static app with the included Dockerfile or any Vite-compatible host.

## Suggested Next Milestones

1. Load organizations, sites, devices, alert rules, and ticket mutations from Supabase with RLS.
2. Add a backend MQTT ingestion service that validates payloads and writes immutable readings into `telemetry_readings`.
3. Issue short-lived MQTT credentials from a trusted backend after Supabase auth.
4. Add Playwright end-to-end tests for auth, alert acknowledgement, ticket workflow, and MQTT-driven telemetry.
