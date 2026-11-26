import { describe, expect, it } from "vitest";
import { CODES, OFFER, REWARD, maxPossibleScore } from "../config";
import schemaPointer from "../../supabase/schema.sql?raw";

const migrations = import.meta.glob<string>("../../supabase/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});
const all = Object.values(migrations).join("\n");

function rule(name: string, body: string): string {
  return `create function syl_private.${name} language sql immutable as $$ select ${body} $$;`;
}

function grants(): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /^grant execute on function public\.(\w+)\(.*\) to (.+);$/gm;
  for (const match of all.matchAll(pattern)) {
    found.set(String(match[1]), String(match[2]));
  }
  return found;
}

describe("supabase migrations", () => {
  it("exist, and schema.sql points to them", () => {
    expect(Object.keys(migrations).length).toBeGreaterThan(0);
    expect(schemaPointer).toContain("supabase/migrations/");
  });

  it("use the same rules as src/config.ts", () => {
    expect(all).toContain(
      rule("max_score() returns integer", String(maxPossibleScore())),
    );
    expect(all).toContain(
      rule("discount_score() returns integer", String(REWARD.discountScore)),
    );
    expect(all).toContain(
      rule("referral_needed() returns integer", String(REWARD.referralNeeded)),
    );
    expect(all).toContain(
      rule(
        "nickname_max_length() returns integer",
        String(REWARD.nicknameMaxLength),
      ),
    );
    expect(all).toContain(
      rule(
        "device_id_max_length() returns integer",
        String(CODES.deviceIdMaxLength),
      ),
    );
    expect(all).toContain(
      `then ${REWARD.referralPercent} else ${REWARD.basePercent} end`,
    );
    expect(all).toContain(
      `then ${OFFER.priceWithShare} else ${OFFER.priceWithCode} end`,
    );
    expect(all).toContain(`'${CODES.alphabet}'`);
    expect(all).toContain(`for attempt in 1..${CODES.maxAttempts} loop`);
  });

  it("expire codes at midnight Warsaw time, the same instant as the client", () => {
    expect(all).toContain("timestamptz '2027-01-01 00:00:00 Europe/Warsaw'");
    expect(Date.parse(CODES.expiresAtIso)).toBe(
      Date.parse("2027-01-01T00:00:00+01:00"),
    );
  });

  it("let anon call only the player RPCs", () => {
    const found = grants();
    for (const name of [
      "issue_code",
      "leaderboard",
      "referral_status",
      "record_referral_finish",
      "start_round",
      "issue_round_score",
    ]) {
      expect(found.get(name)).toBe("anon, authenticated");
    }
    for (const name of [
      "check_code",
      "redeem_code",
      "list_codes",
      "dashboard_stats",
      "hide_nickname",
      "list_top_rounds",
      "get_round_log",
      "confirm_replay",
    ]) {
      expect(found.get(name)).toBe("authenticated");
      expect(all).toMatch(new RegExp(`function public\\.${name}\\(`));
    }
    expect(found.size).toBe(14);
  });

  it("revoke the default function grants before the grants", () => {
    const revokes = all.match(/^revoke all on function public\.\w+\(/gm);
    expect(revokes).toHaveLength(14);
    expect(all).toContain(
      "revoke all on all functions in schema syl_private from public, anon, authenticated;",
    );
  });

  it("turn on RLS for every table and give anon no table access", () => {
    const tables = [
      ...all.matchAll(/^create table (?:if not exists )?public\.(\w+)/gm),
    ].map((m) => m[1]);
    expect(tables).toEqual([
      "scores",
      "codes",
      "referrals",
      "redemptions",
      "staff",
      "referral_links",
      "rounds",
      "round_logs",
    ]);
    for (const table of tables) {
      expect(all).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
    expect(all).not.toMatch(/create policy/i);
    expect(all).not.toMatch(/grant (select|insert|update|delete|all) on/i);
  });

  it("check the staff in every staff function", () => {
    const staffCalls = all.match(/perform syl_private\.require_staff\(\);/g);
    expect(staffCalls).toHaveLength(8);
  });

  it("keep the referral token shape the same as the client", () => {
    expect(all).toContain("check (token ~ '^[2-9A-HJ-NP-Z]{10}$')");
    expect(all).toContain("count(distinct r.device_id)");
  });

  it("give a code only to the device that owns the nickname", () => {
    expect(all).toContain("where s.device_id = excluded.device_id;");
    expect(all).toContain(
      "return syl_private.submit_result(false, 'nickname_taken');",
    );
    expect(all).toContain("create or replace function public.issue_code(");
  });

  it("do not contain a service role key", () => {
    expect(all).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(all).not.toMatch(/sb_secret_/);
  });

  it("keep the anti-cheat caps in sync with src/config.ts", () => {
    expect(all).toMatch(
      /min_wall_ms\(\) returns integer language sql immutable as \$\$ select 20000 \$\$/,
    );
    expect(all).toMatch(
      /max_round_age_ms\(\) returns integer language sql immutable as \$\$ select 180000 \$\$/,
    );
    expect(all).toMatch(
      /rounds_per_hour\(\) returns integer language sql immutable as \$\$ select 20 \$\$/,
    );
    expect(all).toMatch(
      /rounds_per_day\(\) returns integer language sql immutable as \$\$ select 60 \$\$/,
    );
    expect(all).toMatch(
      /log_max_bytes\(\) returns integer language sql immutable as \$\$ select 16384 \$\$/,
    );
  });
});
