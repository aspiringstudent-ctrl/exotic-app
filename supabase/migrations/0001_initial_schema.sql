create extension if not exists "pgcrypto";

create type public.member_role as enum ('owner', 'operator', 'viewer');
create type public.device_kind as enum ('transformer', 'feeder', 'meter', 'inverter');
create type public.device_status as enum ('online', 'attention', 'offline');
create type public.alert_severity as enum ('info', 'warning', 'critical');
create type public.alert_status as enum ('open', 'acknowledged', 'resolved');
create type public.ticket_status as enum ('open', 'scheduled', 'in_progress', 'resolved');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.org_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  region text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  serial_number text not null,
  kind public.device_kind not null,
  status public.device_status not null default 'online',
  rated_capacity_kw numeric(12, 2) not null,
  commissioned_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, serial_number)
);

create table public.telemetry_readings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  captured_at timestamptz not null default now(),
  voltage_v numeric(10, 2) not null,
  current_a numeric(10, 2) not null,
  active_power_kw numeric(12, 2) not null,
  reactive_power_kvar numeric(12, 2) not null,
  power_factor numeric(5, 3) not null,
  frequency_hz numeric(6, 3) not null,
  temperature_c numeric(7, 2) not null,
  total_harmonic_distortion numeric(6, 3) not null,
  load_percent numeric(6, 2) not null,
  created_at timestamptz not null default now()
);

create index telemetry_readings_device_captured_idx
  on public.telemetry_readings (device_id, captured_at desc);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  metric text not null,
  operator text not null check (operator in ('>', '>=', '<', '<=')),
  threshold numeric(12, 3) not null,
  severity public.alert_severity not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  rule_id uuid references public.alert_rules(id) on delete set null,
  severity public.alert_severity not null,
  status public.alert_status not null default 'open',
  title text not null,
  message text not null,
  triggered_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  alert_id uuid references public.alerts(id) on delete set null,
  status public.ticket_status not null default 'open',
  priority public.alert_severity not null default 'warning',
  title text not null,
  assignee text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships memberships
    where memberships.organization_id = org_id
      and memberships.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships memberships
    where memberships.organization_id = org_id
      and memberships.user_id = auth.uid()
      and memberships.role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.sites enable row level security;
alter table public.devices enable row level security;
alter table public.telemetry_readings enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.audit_logs enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Members can read organizations"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "Members can read memberships"
  on public.org_memberships for select
  using (public.is_org_member(organization_id));

create policy "Owners can manage memberships"
  on public.org_memberships for all
  using (public.has_org_role(organization_id, array['owner']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner']::public.member_role[]));

create policy "Members can read sites"
  on public.sites for select
  using (public.is_org_member(organization_id));

create policy "Operators can manage sites"
  on public.sites for all
  using (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]));

create policy "Members can read devices"
  on public.devices for select
  using (public.is_org_member(organization_id));

create policy "Operators can manage devices"
  on public.devices for all
  using (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]));

create policy "Members can read telemetry"
  on public.telemetry_readings for select
  using (public.is_org_member(organization_id));

create policy "Operators can ingest telemetry"
  on public.telemetry_readings for insert
  with check (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]));

create policy "Members can read alert rules"
  on public.alert_rules for select
  using (public.is_org_member(organization_id));

create policy "Operators can manage alert rules"
  on public.alert_rules for all
  using (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]));

create policy "Members can read alerts"
  on public.alerts for select
  using (public.is_org_member(organization_id));

create policy "Operators can manage alerts"
  on public.alerts for all
  using (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]));

create policy "Members can read tickets"
  on public.maintenance_tickets for select
  using (public.is_org_member(organization_id));

create policy "Operators can manage tickets"
  on public.maintenance_tickets for all
  using (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'operator']::public.member_role[]));

create policy "Members can read audit logs"
  on public.audit_logs for select
  using (public.is_org_member(organization_id));
