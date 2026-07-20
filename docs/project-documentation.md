# GridStream Ops Project Documentation

This document is the detailed operating and engineering guide for GridStream Ops. It explains what the project does, how the app is organized, how to run it locally, how Supabase authentication and MQTT telemetry work, and how to troubleshoot the current implementation.

## 1. Project Overview

GridStream Ops is a React, TypeScript, and Vite dashboard for electrical operations teams. It monitors seeded transformers, feeders, meters, and inverter assets, shows live electrical metrics, evaluates alert rules, ranks asset risk, and supports lightweight maintenance ticket workflows.

The current application is production-shaped but still demo-oriented in a few areas:

- Supabase authentication is integrated and can be enforced with environment variables.
- The Supabase database schema and Row Level Security policies are present as migrations.
- A server-side MQTT ingestor can persist complete streaming readings into Supabase.
- Device catalog data, alert actions, and ticket actions are currently client-side in the browser dashboard.
- Telemetry can come from either the deterministic simulator or MQTT-over-WebSocket.
- If MQTT is configured but silent, the dashboard marks MQTT as stale and keeps the UI moving with simulator fallback.

## 2. Core Capabilities

- Email/password sign-in, account creation, magic-link sign-in, session restore, and sign-out through Supabase Auth.
- Local demo access when Supabase is not configured.
- Live fleet KPI cards for load, utilization, critical alerts, risk queue, and peak temperature.
- Asset search and filters by status, asset kind, and site.
- Pause, resume, reset, and CSV export controls.
- Device table with status, region, load, and risk score.
- Device detail panel with selectable telemetry trend metrics.
- Alert Center with acknowledge and create-ticket actions.
- Maintenance ticket board with lane-based workflow.
- Risk Priority panel that ranks assets by alert state and live telemetry stress.
- MQTT telemetry ingestion from browser-safe WebSocket brokers.
- Random MQTT publisher script for generating moving test data.
- Backend MQTT-to-Supabase ingestor for durable telemetry storage.
- Supabase demo seed script for organization, site, device, and alert rule setup.
- Typed domain logic and unit tests for telemetry, alerts, risk, MQTT parsing, and ingestion row mapping.

## 3. Technology Stack

| Area | Technology |
| --- | --- |
| App runtime | React 18, TypeScript, Vite |
| Icons | lucide-react |
| Authentication | Supabase Auth |
| Database schema | Supabase Postgres migration |
| Realtime device input | MQTT over WebSockets |
| MQTT library | mqtt.js |
| Tests | Node test runner through `tsx --test` |
| Linting | ESLint 9 with TypeScript ESLint |
| Packaging | Vite build output, Dockerfile, nginx config |
| Server scripts | Node.js MQTT publisher, Supabase seed, and MQTT ingestor |

## 4. Repository Layout

```text
.
|-- docs/
|   |-- architecture.md
|   `-- project-documentation.md
|-- scripts/
|   |-- ingest-mqtt-to-supabase.mjs
|   |-- publish-random-telemetry.mjs
|   |-- seed-supabase-demo.mjs
|   `-- lib/
|-- src/
|   |-- App.tsx
|   |-- components/
|   |-- data/
|   |-- domain/
|   |-- hooks/
|   |-- lib/
|   |-- services/
|   `-- styles.css
|-- supabase/
|   `-- migrations/
|-- Dockerfile
|-- nginx.conf
|-- package.json
`-- vite.config.ts
```

Important source areas:

- `src/App.tsx`: top-level dashboard composition, tabs, filters, selected device state, CSV export, and source badges.
- `src/components`: presentational and workflow components such as `AuthGate`, `CommandBar`, `DeviceTable`, `TelemetryChart`, `AlertCenter`, `TicketBoard`, and `RiskPanel`.
- `src/data/seed.ts`: demo organization, sites, devices, initial readings, initial alert rules, initial alerts, and initial tickets.
- `src/domain/types.ts`: shared TypeScript types for devices, telemetry, alerts, tickets, risk, and stream source state.
- `src/domain/telemetry.ts`: simulator, metric formatting, alert evaluation, fleet aggregation, and risk scoring.
- `src/hooks/useTelemetryStream.ts`: live stream orchestration, simulator loop, MQTT subscription lifecycle, stale MQTT fallback, local persistence, alert actions, ticket actions, pause, and reset.
- `src/hooks/useSupabaseAuth.ts`: Supabase session restore and auth actions.
- `src/lib/supabase.ts`: lazy Supabase client creation from Vite environment variables.
- `src/services/mqttTelemetry.ts`: MQTT configuration normalization and payload parser.
- `src/services/mqttClient.ts`: mqtt.js browser client, connect, subscribe, message handling, disconnect.
- `scripts/publish-random-telemetry.mjs`: local publisher that sends randomized readings to the configured MQTT broker.
- `scripts/ingest-mqtt-to-supabase.mjs`: trusted backend subscriber that persists complete MQTT readings to Supabase.
- `scripts/seed-supabase-demo.mjs`: idempotent demo catalog seed for Supabase.
- `scripts/lib`: shared Node helpers for runtime configuration and MQTT payload ingestion.
- `supabase/migrations`: production schema foundation, RLS policies, and MQTT ingestion mapping support.

## 5. Local Development

Install dependencies:

```bash
npm ci
```

Start Vite:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

If Supabase variables are missing, the app shows a local demo access screen. Click `Continue demo` to enter the dashboard.

## 6. Environment Variables

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

Variable behavior:

| Variable | Required | Used by | Behavior |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | No | Browser | Enables Supabase Auth when paired with anon key. |
| `VITE_SUPABASE_ANON_KEY` | No | Browser | Enables Supabase Auth when paired with URL. |
| `VITE_MQTT_URL` | No | Browser and publisher | Enables MQTT mode when paired with topic. Bare hosts are normalized to `wss://<host>:8084/mqtt`. |
| `VITE_MQTT_TOPIC` | No | Browser and publisher | MQTT subscription topic, commonly `gridstream/telemetry/#`. |
| `VITE_MQTT_USERNAME` | No | Browser and publisher | Optional MQTT username. |
| `VITE_MQTT_PASSWORD` | No | Browser and publisher | Optional MQTT password. |
| `VITE_MQTT_CLIENT_ID` | No | Browser and scripts | Optional base MQTT client id. |
| `SUPABASE_URL` | No | Server scripts | Server-side Supabase URL. Falls back to `VITE_SUPABASE_URL`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for server scripts | Server scripts | Service-role key used only by seed and ingestion scripts. Never expose in browser builds. |
| `GRIDSTREAM_OWNER_EMAIL` | No | Seed script | Optional signed-up Supabase Auth email to assign as owner of the demo organization. |
| `MQTT_URL` | No | Server scripts | Server-side MQTT URL override. Falls back to `VITE_MQTT_URL`. |
| `MQTT_TOPIC` | No | Server scripts | Server-side MQTT topic override. Falls back to `VITE_MQTT_TOPIC`. |
| `MQTT_USERNAME` | No | Server scripts | Server-side MQTT username override. |
| `MQTT_PASSWORD` | No | Server scripts | Server-side MQTT password override. |
| `MQTT_CLIENT_ID` | No | Server scripts | Server-side MQTT client id base. A random suffix is added. |
| `MQTT_PUBLISH_INTERVAL_MS` | No | Publisher only | Overrides the random publisher interval. Default is `1500`. |

Security note: every `VITE_` variable is bundled for browser use. Do not place privileged MQTT credentials or Supabase service-role keys in Vite environment variables. `SUPABASE_SERVICE_ROLE_KEY` belongs only in trusted server environments.

## 7. Runtime Modes

GridStream Ops has two independent runtime decisions: authentication mode and telemetry source mode.

### Authentication Modes

`demo` mode:

- Active when Supabase URL or anon key is missing.
- Shows a local access screen.
- Does not require a real user session.
- Uses seeded data and local browser state.

`supabase` mode:

- Active when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are both present.
- Restores sessions with Supabase Auth.
- Supports password sign-in, password sign-up, magic link, and sign-out.
- Still uses seeded app data for the dashboard in the current phase.

### Telemetry Source Modes

`simulator` mode:

- Active when MQTT URL or topic is missing.
- Generates new readings every stream interval.
- Evaluates alert rules on every generated reading.
- Keeps a rolling chart history per device.

`mqtt` mode:

- Active when `VITE_MQTT_URL` and `VITE_MQTT_TOPIC` are both present.
- Lazy-loads the MQTT client chunk.
- Connects over WebSocket or secure WebSocket.
- Subscribes to the configured topic with QoS 0.
- Parses incoming payloads and applies telemetry updates for known device IDs.

`mqtt stale` state:

- Used when MQTT is configured but no valid known-device telemetry arrives within 5 seconds.
- Keeps the dashboard alive with simulator fallback.
- Shows an operator-visible error such as `No MQTT telemetry received; simulator fallback active`.

## 8. Dashboard Workflows

### Authentication Gate

`AuthGate` decides whether to show the secure access screen or render the dashboard. If Supabase is configured, unauthenticated users see sign-in, create-account, and magic-link options. If Supabase is not configured, users can enter local demo mode.

### Overview Tab

The Overview tab is the primary operational screen. It includes:

- Fleet KPI cards.
- Command bar controls.
- Device fleet list.
- Selected device detail panel.
- Telemetry chart.
- Risk insight strip.
- Risk priority panel.
- Recent alerts.

### Command Bar

The command bar supports:

- Search across asset name, serial number, kind, status, site name, region, and tags.
- Filter by status: all, online, attention, offline.
- Filter by kind: all, transformer, feeder, meter, inverter.
- Filter by site.
- Pause or resume the stream.
- Export a CSV snapshot.
- Reset local workspace state.

### Device Detail

The selected device panel shows:

- Serial number.
- Device name.
- Status, kind, and risk badges.
- Trend metric selector for load, voltage, temperature, and power factor.
- SVG trend chart.
- Risk score and risk reasons.
- Metric tiles for current live reading values.
- Device tags.

### Alert Center

Alerts are generated when enabled rules are breached by live readings. The Alert Center supports:

- Viewing severity and status badges.
- Acknowledging open alerts.
- Creating one maintenance ticket per alert.
- Seeing relative trigger time.

Alert statuses:

- `open`
- `acknowledged`
- `resolved`

Alerts automatically resolve when the matching device no longer breaches the rule.

### Ticket Board

Tickets are grouped into lanes:

- `open`
- `scheduled`
- `in_progress`
- `resolved`

The `Advance` action moves a ticket through this flow:

```text
open -> scheduled -> in_progress -> resolved
```

Resolved tickets cannot advance further.

### Risk Priority

Risk scores are calculated from:

- Device status.
- Active critical alerts.
- Active warning alerts.
- Load percentage.
- Temperature.
- Power factor.
- Total harmonic distortion.
- Missing readings.

Risk levels:

| Score | Level |
| --- | --- |
| 0 to 34 | `normal` |
| 35 to 69 | `watch` |
| 70 to 100 | `urgent` |

## 9. Seeded Demo Catalog

The current UI uses the catalog in `src/data/seed.ts`.

Organization:

- `org-gridstream-demo`: GridStream Utility

Sites:

- `site-dhaka-north`: Dhaka North Substation
- `site-gazipur`: Gazipur Industrial Feeder
- `site-narayanganj`: Narayanganj Microgrid

Devices:

| Device ID | Name | Kind | Status |
| --- | --- | --- | --- |
| `dev-tx-01` | TX-01 Main Transformer | transformer | attention |
| `dev-fdr-11` | Feeder 11 Commercial | feeder | online |
| `dev-mtr-07` | Meter Bank 07 | meter | online |
| `dev-inv-03` | Solar Inverter 03 | inverter | online |
| `dev-tx-04` | TX-04 Industrial Transformer | transformer | online |
| `dev-fdr-18` | Feeder 18 Riverfront | feeder | offline |

Known device IDs matter for MQTT. Incoming telemetry for unknown device IDs is ignored by the UI and causes MQTT state to become stale if no known devices are present.

## 10. Telemetry Metrics

The main telemetry type is `TelemetryReading`.

| Field | Unit | Notes |
| --- | --- | --- |
| `voltageV` | V | Nominal base depends on device kind. |
| `currentA` | A | Calculated from power, voltage, and power factor in simulator/publisher. |
| `activePowerKw` | kW | Real power. |
| `reactivePowerKvar` | kVAR | Reactive power. |
| `powerFactor` | none | Expected range is usually around `0.74` to `0.99` in generated data. |
| `frequencyHz` | Hz | Generated around 50 Hz. |
| `temperatureC` | C | Increases as load stress increases. |
| `totalHarmonicDistortion` | % | Higher for stressed devices and inverter data. |
| `loadPercent` | % | Alert and risk-sensitive utilization metric. |

## 11. Alert Rules

Current seeded rules:

| Rule ID | Metric | Operator | Threshold | Severity |
| --- | --- | --- | --- | --- |
| `rule-overload` | `loadPercent` | `>=` | `92` | critical |
| `rule-hot-equipment` | `temperatureC` | `>=` | `68` | critical |
| `rule-low-pf` | `powerFactor` | `<` | `0.86` | warning |
| `rule-thd` | `totalHarmonicDistortion` | `>=` | `5.2` | warning |

Alert evaluation is implemented in `src/domain/telemetry.ts`. The stream hook runs evaluation for every simulator reading and every accepted MQTT reading.

## 12. MQTT Integration

### Broker Requirements

The browser client needs a broker endpoint that supports MQTT over WebSockets. Typical secure endpoint format:

```text
wss://broker.example.com:8084/mqtt
```

If `VITE_MQTT_URL` is set to a bare host, the app normalizes it to:

```text
wss://<host>:8084/mqtt
```

If a user pastes an `mqtt://`, `mqtts://`, or `tcp://` broker URL, the app converts it to a browser WebSocket URL by removing the broker protocol and using `wss://`. Existing `ws://` and `wss://` URLs are preserved as entered.

The subscription topic is controlled by `VITE_MQTT_TOPIC`.

### Accepted MQTT Payload Shapes

The parser accepts:

1. A single JSON object.
2. An array of JSON objects.
3. An object with a `readings` array.
4. An object with a `devices` array.

Example single reading:

```json
{
  "device_id": "dev-tx-01",
  "captured_at": "2026-07-21T10:00:00.000Z",
  "voltage_v": 410.5,
  "current_a": 120.2,
  "active_power_kw": 740,
  "reactive_power_kvar": 298.4,
  "power_factor": 0.91,
  "frequency_hz": 50.01,
  "temperature_c": 63.5,
  "total_harmonic_distortion": 4.9,
  "load_percent": 88.4
}
```

Example batch:

```json
{
  "readings": [
    {
      "device_id": "dev-tx-01",
      "load_percent": 94.2,
      "temperature_c": 69.1,
      "power_factor": 0.82
    },
    {
      "device_id": "dev-fdr-11",
      "load_percent": 71.4,
      "temperature_c": 53.2,
      "power_factor": 0.9
    }
  ]
}
```

### Accepted Field Aliases

Device id aliases:

- `deviceId`
- `device_id`
- `assetId`
- `asset_id`

Timestamp aliases:

- `capturedAt`
- `captured_at`
- `timestamp`
- `time`

Metric aliases:

| Internal metric | Accepted payload keys |
| --- | --- |
| `voltageV` | `voltageV`, `voltage_v`, `voltage` |
| `currentA` | `currentA`, `current_a`, `current` |
| `activePowerKw` | `activePowerKw`, `active_power_kw`, `active_kw`, `powerKw`, `power_kw` |
| `reactivePowerKvar` | `reactivePowerKvar`, `reactive_power_kvar`, `reactive_kvar` |
| `powerFactor` | `powerFactor`, `power_factor`, `pf` |
| `frequencyHz` | `frequencyHz`, `frequency_hz`, `frequency` |
| `temperatureC` | `temperatureC`, `temperature_c`, `temperature` |
| `totalHarmonicDistortion` | `totalHarmonicDistortion`, `total_harmonic_distortion`, `thd`, `thd_percent` |
| `loadPercent` | `loadPercent`, `load_percent`, `load` |

Records without a known device id or without at least one numeric metric are ignored.

### MQTT Merge Behavior

MQTT updates can be partial. The stream keeps the previous reading for the device and overlays only the received metric values. The resulting reading gets:

- `id`: generated as `deviceId-mqtt-tick-index`.
- `capturedAt`: the payload timestamp if valid, otherwise the receive time.
- `deviceId`: the known seeded device id.

The updated reading is appended to that device history, and history is capped at 48 points.

## 13. Random MQTT Publisher

Use the publisher when the browser connects to MQTT but the dashboard data is not changing.

Run the dashboard in one terminal:

```bash
npm run dev
```

Run the publisher in another terminal:

```bash
npm run mqtt:publish
```

The publisher:

- Reads `.env` and `.env.local`, with shell environment variables taking priority.
- Uses `MQTT_URL`, `MQTT_TOPIC`, `MQTT_USERNAME`, `MQTT_PASSWORD`, and `MQTT_CLIENT_ID`, falling back to the matching `VITE_MQTT_*` values.
- Publishes one JSON message per seeded device.
- Publishes to the base topic plus the device id.
- Uses random but bounded values around each device baseline.
- Publishes every 1500 ms by default.
- Keeps `dev-fdr-18` offline with zero power values.

Override interval:

```bash
MQTT_PUBLISH_INTERVAL_MS=750 npm run mqtt:publish
```

If `MQTT_TOPIC` or `VITE_MQTT_TOPIC` is:

```text
gridstream/telemetry/#
```

the publisher sends to:

```text
gridstream/telemetry/dev-tx-01
gridstream/telemetry/dev-fdr-11
gridstream/telemetry/dev-mtr-07
gridstream/telemetry/dev-inv-03
gridstream/telemetry/dev-tx-04
gridstream/telemetry/dev-fdr-18
```

## 14. MQTT To Supabase Persistence

The browser MQTT client is for live display. Durable storage is handled by a trusted Node process so the Supabase service-role key is never shipped to the browser.

Required setup:

1. Run every migration in `supabase/migrations/` in order.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or the server environment.
3. Optionally set `GRIDSTREAM_OWNER_EMAIL` to an email that has already signed up in Supabase Auth.
4. Seed the demo catalog or create your own devices with `external_id` values matching MQTT `device_id` or `asset_id` values.

The seed script also assigns `GRIDSTREAM_OWNER_EMAIL` as an owner membership when that profile exists.

Seed the demo catalog:

```bash
npm run supabase:seed
```

Start ingestion:

```bash
npm run mqtt:ingest
```

Publish demo readings from another terminal:

```bash
npm run mqtt:publish
```

The ingestor loads `devices.id`, `devices.organization_id`, and `devices.external_id` from Supabase. For every MQTT payload, it validates and inserts complete rows into `telemetry_readings`. Payloads for unknown devices are skipped and trigger a catalog refresh. Partial payloads are skipped for persistence because `telemetry_readings` requires every electrical metric.

Required database fields per persisted reading:

- `voltage_v`
- `current_a`
- `active_power_kw`
- `reactive_power_kvar`
- `power_factor`
- `frequency_hz`
- `temperature_c`
- `total_harmonic_distortion`
- `load_percent`

## 15. Supabase Integration

### Client Behavior

`src/lib/supabase.ts` creates the Supabase client only when both public browser variables are configured:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The client is configured with:

- automatic token refresh
- session detection from URL
- persistent browser session storage

### Auth Actions

`src/hooks/useSupabaseAuth.ts` exposes:

- `signInWithPassword(email, password)`
- `signUpWithPassword(email, password)`
- `sendMagicLink(email)`
- `signOut()`
- current `session`
- current `user`
- `loading`
- whether Supabase is `configured`

### Database Schema

The migrations create:

- `profiles`
- `organizations`
- `org_memberships`
- `sites`
- `devices` with `external_id` mapping for MQTT payload IDs
- `telemetry_readings`
- `alert_rules`
- `alerts`
- `maintenance_tickets`
- `audit_logs`

It also creates enum types for:

- member role
- device kind
- device status
- alert severity
- alert status
- ticket status

### Row Level Security

RLS is enabled for all application tables. Policies enforce:

- Users can read and update their own profile.
- Organization data is readable only by members.
- Owners can manage memberships.
- Owners and operators can manage sites, devices, alert rules, alerts, and tickets.
- Operators can insert telemetry readings.
- Members can read audit logs.

### Current Limitation

The schema is ready for production persistence, but the current React dashboard still loads seeded catalog data from `src/data/seed.ts`. A future phase should replace seeded data with Supabase queries and mutations protected by these RLS policies.

## 16. Local Persistence

The stream hook persists operator actions to browser local storage under:

```text
gridstream-ops-state-v2
```

Persisted fields:

- alerts
- maintenance tickets

The reset action clears this local storage key and restores the seeded alert and ticket state.

## 17. Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server on all interfaces. |
| `npm run build` | Run TypeScript project build and Vite production build. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript build checks. |
| `npm run test` | Run telemetry and MQTT parser unit tests. |
| `npm run mqtt:publish` | Publish randomized MQTT telemetry from `.env.local`. |
| `npm run mqtt:ingest` | Subscribe to MQTT and insert complete telemetry rows into Supabase. |
| `npm run supabase:seed` | Seed the demo organization, sites, devices, and alert rules into Supabase. |
| `npm run check` | Run lint, typecheck, tests, and production build. |

Recommended validation before pushing:

```bash
npm run check
```

Or run each gate separately:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 18. Testing Strategy

Current unit tests cover:

- metric comparison operators
- generated telemetry bounds
- alert generation
- fleet summary aggregation
- risk scoring and ranking
- snake_case MQTT payload parsing
- batched MQTT payload parsing
- invalid MQTT payload rejection
- database ingestion row mapping and skip behavior

Recommended next tests:

- `useTelemetryStream` stale MQTT fallback behavior.
- `AuthGate` demo and Supabase-configured states.
- CSV export content.
- Ticket workflow transitions.
- Playwright end-to-end test for dashboard rendering and MQTT-driven updates.

## 19. Production Deployment

Static hosting path:

1. Configure public environment variables in the host.
2. Run `npm run build`.
3. Serve the generated `dist/` directory.

Docker path:

1. Build the Docker image from the included `Dockerfile`.
2. The build output is served by nginx.
3. Ensure host-level environment injection happens at build time for Vite variables.

Supabase path:

1. Create a Supabase project.
2. Run every SQL file in `supabase/migrations/` in order.
3. Enable desired email auth providers.
4. Add users through Supabase Auth.
5. Create organizations and memberships, or set `GRIDSTREAM_OWNER_EMAIL` before running the seed script.
6. Run `npm run supabase:seed` for the demo catalog, or load your own devices with `external_id` values.
7. Replace seeded dashboard reads with Supabase-backed data access.

MQTT path:

1. Use a broker that supports MQTT over WebSockets.
2. Create browser-scoped credentials.
3. Restrict browser clients to only the required read topics.
4. Run `npm run mqtt:ingest` on a trusted server for persistence.
5. Prefer read-only browser subscriptions for production.
6. Use a trusted backend for validation, persistence, and privileged broker credentials.

## 20. Security Notes

- Never put Supabase service-role keys in `VITE_` variables.
- Never put privileged broker credentials in `VITE_` variables.
- Browser MQTT credentials are visible to users.
- Use broker ACLs to restrict publish and subscribe permissions.
- Treat all MQTT payloads as untrusted input.
- Validate telemetry on a backend before writing it to the database.
- Keep service-role Supabase access only in backend processes.
- Keep raw telemetry immutable and store derived operational state separately.

## 21. Troubleshooting

### Supabase Login Screen Does Not Appear

Check that both variables are present:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Restart Vite after changing `.env.local`.

### Supabase Auth Errors

Check:

- Email/password provider is enabled in Supabase.
- Site URL and redirect URLs match the dev or deployed URL.
- The anon key belongs to the same Supabase project as the URL.
- The user has confirmed email if confirmation is enabled.

### MQTT Shows Connected But Data Does Not Change

Most common causes:

- No messages are being published.
- Messages are on a different topic than `VITE_MQTT_TOPIC`.
- Payload device IDs do not match seeded IDs.
- Payload fields do not contain numeric metric values.
- Broker ACL allows connect but blocks subscribe or publish.

Use:

```bash
npm run mqtt:publish
```

Then confirm the dashboard source badge changes from stale to live and chart values move.

### MQTT Error After Editing `.env.local`

Check:

- Use a WebSocket URL, normally `wss://host:8084/mqtt`.
- If using a bare host, the app assumes port `8084` and path `/mqtt`.
- If pasting an `mqtt://`, `mqtts://`, or `tcp://` broker URL, confirm the resulting WebSocket host, port, and path match the broker's WebSocket listener.
- Username and password are correct.
- Broker supports browser WebSocket connections.
- Topic ACL allows the configured topic.
- Restart Vite after editing `.env.local`.

### Graph Disappears

The chart needs history for the selected device. Current code preserves readings and history while advancing stream state. If a graph disappears again, inspect:

- `src/hooks/useTelemetryStream.ts` for state replacement bugs.
- Whether incoming MQTT data uses known device IDs.
- Whether the selected device is filtered out.
- Whether history is being appended and capped at 48 points.

### MQTT Ingestor Does Not Insert Rows

Check:

- `SUPABASE_SERVICE_ROLE_KEY` is set only in the server environment.
- All migrations, including `0002_mqtt_ingestion_support.sql`, have run.
- `npm run supabase:seed` has created devices with matching `external_id` values.
- If checking data through user-scoped RLS, the user has an `org_memberships` row.
- MQTT payloads contain all required electrical metrics.
- The ingestor terminal logs `inserted ... telemetry rows`.

### Random Publisher Connects But Dashboard Is Still Stale

Check that the dashboard and publisher use the same `.env.local` topic. For wildcard subscriptions, use:

```bash
VITE_MQTT_TOPIC="gridstream/telemetry/#"
```

The publisher strips the wildcard and publishes each device below the base topic.

### Build Fails After Environment Changes

Run:

```bash
npm run typecheck
npm run lint
```

Vite environment variables are statically replaced. Restart the dev server or rebuild after changing them.

## 22. Known Gaps And Next Engineering Phase

High-value next tasks:

1. Load organizations, sites, devices, alert rules, alerts, tickets, and recent readings from Supabase.
2. Add Supabase mutations for alert acknowledgement and ticket workflow.
3. Promote `npm run mqtt:ingest` into a managed backend service with health checks, logs, and deploy configuration.
4. Issue short-lived MQTT credentials after Supabase auth.
5. Add database seed scripts for demo organizations and memberships.
6. Add Playwright tests for auth, live dashboard updates, alerts, tickets, and CSV export.
7. Add dashboard-level loading and empty states for Supabase data fetching.
8. Add audit log writes for alert and ticket actions.
9. Add retention or partitioning strategy for high-volume telemetry.

## 23. Development Conventions

- Keep domain behavior in `src/domain` and cover it with unit tests.
- Keep network adapters in `src/services`.
- Keep React state orchestration in hooks.
- Keep components focused on display and user interaction.
- Keep seeded data separate from production data access.
- Keep browser credentials scoped and replace privileged actions with backend services.
- Prefer typed transformations over ad hoc parsing when changing telemetry contracts.

## 24. Quick Verification Checklist

Use this checklist after changes:

```bash
npm run check
```

Manual checks:

- App opens at `http://localhost:5173`.
- Demo mode works when Supabase is not configured.
- Supabase sign-in screen appears when Supabase is configured.
- Simulator updates KPI cards and chart values.
- MQTT source connects with valid broker config.
- `npm run mqtt:publish` makes dashboard values change.
- Alerts can be acknowledged.
- Tickets can be created and advanced.
- CSV export downloads a current fleet snapshot.
