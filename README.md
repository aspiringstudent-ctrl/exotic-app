# GridStream Ops

GridStream Ops is a production-shaped electrical telemetry dashboard for monitoring transformers, feeders, meters, and distributed energy assets. The current MVP runs with deterministic simulated streaming data and includes a Supabase schema for a real deployment path.

## What Is Included

- React + TypeScript + Vite app
- Live telemetry simulation for voltage, current, load, temperature, harmonics, and power factor
- Fleet KPIs, device detail panel, sparkline trends, alert feed, and maintenance tickets
- Typed domain logic with unit tests
- Supabase migration with organizations, membership, devices, readings, alert rules, alerts, tickets, and audit logs
- Docker, CI, lint, typecheck, and test scripts

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

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
3. Add Supabase URL and anon key to `.env.local`.
4. Replace `src/hooks/useTelemetryStream.ts` with a Supabase Realtime channel or backend WebSocket.
5. Deploy the static app with the included Dockerfile or any Vite-compatible host.

## Suggested Next Milestones

1. Add Supabase Auth and organization switching.
2. Store alert acknowledgement and ticket updates through Row Level Security policies.
3. Connect real devices through MQTT, Kafka, or a FastAPI ingestion service.
4. Add Playwright end-to-end tests for alert and ticket workflows.
