alter table public.devices
  add column if not exists external_id text;

comment on column public.devices.external_id is
  'Stable source identifier used to map MQTT device_id or asset_id payloads to database devices.';

update public.devices
set external_id = metadata ->> 'external_id'
where external_id is null
  and metadata ? 'external_id';

create unique index if not exists devices_organization_external_id_idx
  on public.devices (organization_id, external_id)
  where external_id is not null;

create index if not exists telemetry_readings_organization_captured_idx
  on public.telemetry_readings (organization_id, captured_at desc);
