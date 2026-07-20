#!/usr/bin/env node
/* global console */
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig, loadRuntimeEnv } from "./lib/runtime-config.mjs";

const organization = {
  name: "GridStream Utility",
  slug: "gridstream-utility",
};

const sites = [
  {
    localId: "site-dhaka-north",
    name: "Dhaka North Substation",
    region: "Dhaka",
    latitude: 23.8103,
    longitude: 90.4125,
  },
  {
    localId: "site-gazipur",
    name: "Gazipur Industrial Feeder",
    region: "Gazipur",
    latitude: 24.0023,
    longitude: 90.4264,
  },
  {
    localId: "site-narayanganj",
    name: "Narayanganj Microgrid",
    region: "Narayanganj",
    latitude: 23.6238,
    longitude: 90.5,
  },
];

const devices = [
  {
    externalId: "dev-tx-01",
    siteLocalId: "site-dhaka-north",
    name: "TX-01 Main Transformer",
    serialNumber: "GST-TX-1001",
    kind: "transformer",
    status: "attention",
    ratedCapacityKw: 1250,
    baselineLoadPercent: 86,
    commissionedAt: "2022-04-12",
    firmwareVersion: "4.8.2",
    tags: ["11kV", "critical", "oil-cooled"],
  },
  {
    externalId: "dev-fdr-11",
    siteLocalId: "site-dhaka-north",
    name: "Feeder 11 Commercial",
    serialNumber: "GST-FDR-2011",
    kind: "feeder",
    status: "online",
    ratedCapacityKw: 830,
    baselineLoadPercent: 68,
    commissionedAt: "2021-09-02",
    firmwareVersion: "3.15.0",
    tags: ["commercial", "north-ring"],
  },
  {
    externalId: "dev-mtr-07",
    siteLocalId: "site-gazipur",
    name: "Meter Bank 07",
    serialNumber: "GST-MTR-3007",
    kind: "meter",
    status: "online",
    ratedCapacityKw: 320,
    baselineLoadPercent: 61,
    commissionedAt: "2023-01-18",
    firmwareVersion: "2.9.5",
    tags: ["industrial", "billing"],
  },
  {
    externalId: "dev-inv-03",
    siteLocalId: "site-narayanganj",
    name: "Solar Inverter 03",
    serialNumber: "GST-INV-4003",
    kind: "inverter",
    status: "online",
    ratedCapacityKw: 420,
    baselineLoadPercent: 74,
    commissionedAt: "2024-03-22",
    firmwareVersion: "6.3.1",
    tags: ["solar", "microgrid"],
  },
  {
    externalId: "dev-tx-04",
    siteLocalId: "site-gazipur",
    name: "TX-04 Industrial Transformer",
    serialNumber: "GST-TX-1004",
    kind: "transformer",
    status: "online",
    ratedCapacityKw: 1800,
    baselineLoadPercent: 77,
    commissionedAt: "2020-11-30",
    firmwareVersion: "4.7.9",
    tags: ["33kV", "industrial"],
  },
  {
    externalId: "dev-fdr-18",
    siteLocalId: "site-narayanganj",
    name: "Feeder 18 Riverfront",
    serialNumber: "GST-FDR-2018",
    kind: "feeder",
    status: "offline",
    ratedCapacityKw: 540,
    baselineLoadPercent: 0,
    commissionedAt: "2019-06-06",
    firmwareVersion: "3.12.4",
    tags: ["maintenance", "riverfront"],
  },
];

const alertRules = [
  {
    name: "Load above operating limit",
    metric: "loadPercent",
    operator: ">=",
    threshold: 92,
    severity: "critical",
    enabled: true,
  },
  {
    name: "Equipment temperature high",
    metric: "temperatureC",
    operator: ">=",
    threshold: 68,
    severity: "critical",
    enabled: true,
  },
  {
    name: "Power factor below target",
    metric: "powerFactor",
    operator: "<",
    threshold: 0.86,
    severity: "warning",
    enabled: true,
  },
  {
    name: "Harmonic distortion elevated",
    metric: "totalHarmonicDistortion",
    operator: ">=",
    threshold: 5.2,
    severity: "warning",
    enabled: true,
  },
];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const env = loadRuntimeEnv();
  const config = getSupabaseServerConfig(env);
  const supabase = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const organizationId = await ensureOrganization(supabase);
  const siteIds = await ensureSites(supabase, organizationId);
  await ensureDevices(supabase, organizationId, siteIds);
  await ensureAlertRules(supabase, organizationId);
  await ensureOwnerMembership(supabase, organizationId, env.GRIDSTREAM_OWNER_EMAIL);

  console.log(`seeded ${organization.name}: ${sites.length} sites, ${devices.length} devices, ${alertRules.length} alert rules`);
}

async function ensureOrganization(supabase) {
  const { data: existing, error: selectError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", organization.slug)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const { error } = await supabase
      .from("organizations")
      .update({ name: organization.name })
      .eq("id", existing.id);

    if (error) {
      throw error;
    }

    return existing.id;
  }

  const { data, error } = await supabase
    .from("organizations")
    .insert(organization)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

async function ensureSites(supabase, organizationId) {
  const siteIds = new Map();

  for (const site of sites) {
    const row = {
      organization_id: organizationId,
      name: site.name,
      region: site.region,
      latitude: site.latitude,
      longitude: site.longitude,
    };
    const { data: existing, error: selectError } = await supabase
      .from("sites")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", site.name)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existing) {
      const { error } = await supabase.from("sites").update(row).eq("id", existing.id);

      if (error) {
        throw error;
      }

      siteIds.set(site.localId, existing.id);
      continue;
    }

    const { data, error } = await supabase.from("sites").insert(row).select("id").single();

    if (error) {
      throw error;
    }

    siteIds.set(site.localId, data.id);
  }

  return siteIds;
}

async function ensureDevices(supabase, organizationId, siteIds) {
  for (const device of devices) {
    const siteId = siteIds.get(device.siteLocalId);

    if (!siteId) {
      throw new Error(`No site found for ${device.siteLocalId}`);
    }

    const row = {
      organization_id: organizationId,
      site_id: siteId,
      external_id: device.externalId,
      name: device.name,
      serial_number: device.serialNumber,
      kind: device.kind,
      status: device.status,
      rated_capacity_kw: device.ratedCapacityKw,
      commissioned_at: device.commissionedAt,
      metadata: {
        baselineLoadPercent: device.baselineLoadPercent,
        firmwareVersion: device.firmwareVersion,
        tags: device.tags,
      },
    };
    const { data: existing, error: selectError } = await supabase
      .from("devices")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("external_id", device.externalId)
      .maybeSingle();

    if (selectError) {
      throw decorateExternalIdError(selectError);
    }

    if (existing) {
      const { error } = await supabase.from("devices").update(row).eq("id", existing.id);

      if (error) {
        throw decorateExternalIdError(error);
      }

      continue;
    }

    const { error } = await supabase.from("devices").insert(row);

    if (error) {
      throw decorateExternalIdError(error);
    }
  }
}

async function ensureAlertRules(supabase, organizationId) {
  for (const rule of alertRules) {
    const row = { ...rule, organization_id: organizationId };
    const { data: existing, error: selectError } = await supabase
      .from("alert_rules")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", rule.name)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existing) {
      const { error } = await supabase.from("alert_rules").update(row).eq("id", existing.id);

      if (error) {
        throw error;
      }

      continue;
    }

    const { error } = await supabase.from("alert_rules").insert(row);

    if (error) {
      throw error;
    }
  }
}

async function ensureOwnerMembership(supabase, organizationId, email) {
  const normalizedEmail = email?.trim();

  if (!normalizedEmail) {
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    console.log(`no Supabase profile found for ${normalizedEmail}; sign up first, then rerun seed`);
    return;
  }

  const { error } = await supabase.from("org_memberships").upsert(
    {
      organization_id: organizationId,
      user_id: profile.id,
      role: "owner",
    },
    { onConflict: "organization_id,user_id" },
  );

  if (error) {
    throw error;
  }

  console.log(`assigned owner membership to ${normalizedEmail}`);
}

function decorateExternalIdError(error) {
  if (error.message?.includes("external_id")) {
    return new Error(`${error.message}. Run supabase/migrations/0002_mqtt_ingestion_support.sql before seeding.`);
  }

  return error;
}
