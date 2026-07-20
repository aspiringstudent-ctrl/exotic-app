# GridStream Ops

GridStream Ops is a production-shaped electrical telemetry dashboard for monitoring transformers, feeders, meters, and distributed energy assets. It supports a deterministic simulator for local demos, Supabase authentication for production access, and MQTT-over-WebSocket telemetry ingestion for live device streams.

For a deeper engineering and operations guide, see [docs/project-documentation.md](docs/project-documentation.md).

## What Is Included

- React + TypeScript + Vite app
- Supabase email/password, sign-up, sign-out, and magic-link authentication
- MQTT-over-WebSocket telemetry source with simulator fallback
- Live telemetry for voltage, current, load, temperature, harmonics, and power factor
- Fleet KPIs, device detail panel, trend charts, alert feed, and maintenance tickets
- Operator cockpit controls for search, filters, pause/resume, reset, and CSV export
- Risk-ranked dispatch panel that prioritizes stressed assets from alerts and telemetry
- Persisted local operator actions for demo acknowledgements and ticket workflow
- Typed domain logic with unit tests
- Supabase migrations with profiles, organizations, memberships, MQTT device mapping, devices, readings, alert rules, alerts, tickets, audit logs, RLS policies, and an auth profile trigger
- Docker, CI, lint, typecheck, ingestion, seed, and test scripts

## Local Setup

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. If Supabase env vars are blank, the app shows a local demo access screen and uses simulated telemetry.

## Environment

Create `.env.local` from `.env.example`. Leave Supabase values blank for demo mode and MQTT values blank for simulator mode.

```bash
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
GRIDSTREAM_OWNER_EMAIL=""

VITE_MQTT_URL="wss://broker.example.com:8084/mqtt"
VITE_MQTT_TOPIC="gridstream/telemetry/#"
VITE_MQTT_USERNAME="optional-browser-scoped-user"
VITE_MQTT_PASSWORD="optional-browser-scoped-password"
VITE_MQTT_CLIENT_ID="optional-client-id"

MQTT_URL=""
MQTT_TOPIC=""
MQTT_USERNAME=""
MQTT_PASSWORD=""
MQTT_CLIENT_ID=""
MQTT_PUBLISH_INTERVAL_MS="1500"
```

MQTT credentials in Vite are public browser credentials. Use broker ACLs, short-lived credentials, or a backend token exchange before connecting real production assets. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use the `VITE_` prefix.

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

Use the included publisher to send randomized telemetry for every seeded device to the broker configured in `.env.local` or the server environment. Run it in a second terminal while the Vite app is open.

```bash
npm run mqtt:publish
```

The script publishes one JSON message per known device every 1.5 seconds. Override the interval when needed:

```bash
MQTT_PUBLISH_INTERVAL_MS=750 npm run mqtt:publish
```

## Supabase Telemetry Ingestion

The browser displays MQTT data live. To persist streaming readings, run the backend ingestor with server-only Supabase credentials.

1. Run every SQL file in `supabase/migrations/`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or the server environment.
3. Optionally set `GRIDSTREAM_OWNER_EMAIL` to an email that has already signed up in Supabase Auth.
4. Seed the demo catalog so MQTT IDs map to Supabase UUIDs:

```bash
npm run supabase:seed
```

5. Start the MQTT-to-Supabase ingestor:

```bash
npm run mqtt:ingest
```

6. In another terminal, publish test readings:

```bash
npm run mqtt:publish
```

The ingestor writes complete records into `telemetry_readings`. Partial MQTT records are skipped for database persistence because the table requires every electrical metric.

## Quality Gates

```bash
npm run check
```

Or run the checks individually:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Production Path

1. Create a Supabase project.
2. Run every SQL file in `supabase/migrations/` in order.
3. Enable the email auth providers you want in Supabase Auth.
4. Add Supabase and MQTT env vars to `.env.local` or your host environment.
5. Run `npm run supabase:seed` for the demo catalog, or load your own devices with `external_id` values matching MQTT payload IDs.
6. Run `npm run mqtt:ingest` on a trusted server to persist streaming readings.
7. Configure MQTT broker WebSocket access and topic ACLs for browser clients.
8. Move authoritative alert evaluation and ticket mutation writes server-side before connecting critical infrastructure.
9. Deploy the static app with the included Dockerfile or any Vite-compatible host.

## Suggested Next Milestones

1. Load organizations, sites, devices, alert rules, tickets, and recent readings into the dashboard from Supabase with RLS.
2. Promote `npm run mqtt:ingest` into a managed service with health checks, logs, and deployment configuration.
3. Issue short-lived MQTT credentials from a trusted backend after Supabase auth.
4. Add Playwright end-to-end tests for auth, alert acknowledgement, ticket workflow, persistence, and MQTT-driven telemetry.
