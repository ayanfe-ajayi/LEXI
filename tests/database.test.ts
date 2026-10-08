import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
let pg: PGlite;
let wid: string;
let senses: { id: string }[];
const entry = {
  word: "meticulous",
  senses: [
    {
      part_of_speech: "adjective",
      definition: "Showing great attention to detail.",
      simple_definition: "Very careful about details.",
      usage_note: "",
      register: "neutral",
      difficulty: "advanced",
      synonyms: ["careful"],
      phrases: ["meticulous work"],
      examples: [
        {
          sentence: "She was meticulous when checking the report.",
          source: "Test dictionary",
        },
      ],
      lexical_source: "Test dictionary",
      source_url: null,
      source_license: null,
      ai_enriched: false,
    },
    {
      part_of_speech: "adjective",
      definition: "Concerned with precise procedures.",
      simple_definition: "Very exact in following a procedure.",
      usage_note: "",
      register: "neutral",
      difficulty: "advanced",
      synonyms: [],
      phrases: [],
      examples: [],
      lexical_source: "Test dictionary",
      source_url: null,
      source_license: null,
      ai_enriched: false,
    },
  ],
  pronunciations: [],
};
beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  await pg.exec(
    `create schema auth;create schema extensions;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  for (const file of readdirSync("supabase/migrations").sort())
    await pg.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
});
beforeEach(async () => {
  await pg.exec(
    "reset role;truncate auth.users cascade;truncate public.words cascade;",
  );
  await pg.query(
    "insert into auth.users(id,raw_user_meta_data) values ($1,$3),($2,$3)",
    [A, B, JSON.stringify({ display_name: "Test learner" })],
  );
  const saved = await pg.query<{ id: string }>(
    "select public.save_lexical_word($1,$2,'note','Book','a sentence') id",
    [A, JSON.stringify(entry)],
  );
  wid = saved.rows[0].id;
  senses = (
    await pg.query<{ id: string }>(
      "select id from public.word_senses where word_id=$1 order by created_at,id",
      [wid],
    )
  ).rows;
});
afterEach(async () => {
  await pg.exec("reset role");
});
afterAll(async () => {
  await pg.close();
});
async function asUser(user: string) {
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await pg.exec("set role authenticated");
}
async function review(
  correct: boolean,
  request = crypto.randomUUID(),
  sense = senses[0].id,
  type = "reverse_recall",
) {
  return (
    await pg.query<{ result: any }>(
      "select public.record_review($1,$2,$3,$4,$5,$6,$7,$8) result",
      [A, request, sense, type, correct, "meticulous", "feedback", 1000],
    )
  ).rows[0].result;
}
describe("actual migrations and learning transactions", () => {
  it("caches canonical lookup without adding a personal word", async () => {
    await pg.query("select public.save_lexical_word(null,$1,'','','')", [
      JSON.stringify({ ...entry, word: "careful" }),
    ]);
    expect((await pg.query("select * from words")).rows).toHaveLength(2);
    expect((await pg.query("select * from user_words")).rows).toHaveLength(1);
  });
  it("enforces the hourly server quota", async () => {
    for (let i = 0; i < 100; i++)
      expect(
        (
          await pg.query<{ allowed: boolean }>(
            "select consume_api_quota($1) allowed",
            [A],
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          "select consume_api_quota($1) allowed",
          [A],
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("claims eligible reminders once and respects quiet hours on retries", async () => {
    await pg.exec(
      "update user_sense_progress set next_review_at=now()-interval '1 hour'",
    );
    await pg.query(
      "update reminder_preferences set enabled=true,timezone='UTC',preferred_time='00:00',quiet_start=((now() at time zone 'UTC')+interval '1 hour')::time,quiet_end=((now() at time zone 'UTC')+interval '2 hours')::time where user_id=$1",
      [A],
    );
    await pg.query(
      "insert into push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://fcm.googleapis.com/test','test','test')",
      [A],
    );
    expect(
      (await pg.query("select * from claim_due_reminders()")).rows,
    ).toHaveLength(1);
    expect(
      (await pg.query("select * from claim_due_reminders()")).rows,
    ).toHaveLength(0);
    await pg.exec(
      "update reminders set status='failed';update reminder_preferences set quiet_start=((now() at time zone 'UTC')-interval '1 hour')::time,quiet_end=((now() at time zone 'UTC')+interval '1 hour')::time",
    );
    expect(
      (await pg.query("select * from claim_due_reminders()")).rows,
    ).toHaveLength(0);
    expect((await pg.query("select * from reminders")).rows).toHaveLength(1);
  });
  it("creates profiles, preferences, distinct senses and initial one-day schedules", async () => {
    expect((await pg.query("select * from profiles")).rows).toHaveLength(2);
    expect(senses).toHaveLength(2);
    const p = await pg.query<{ days: number }>(
      "select round(extract(epoch from (next_review_at-now()))/86400) days from user_sense_progress",
    );
    expect(p.rows.map((r) => Number(r.days))).toEqual([1, 1]);
  });
  it("reuses canonical data and schedules when saving a word again", async () => {
    await pg.query(
      "select public.save_lexical_word($1,$2,'changed','Movie','context')",
      [A, JSON.stringify(entry)],
    );
    expect((await pg.query("select * from words")).rows).toHaveLength(1);
    expect((await pg.query("select * from user_words")).rows).toHaveLength(1);
    expect(
      (await pg.query("select * from user_sense_progress")).rows,
    ).toHaveLength(2);
  });
  it("advances 3,7,14,30,60 days and resets failures to one day", async () => {
    for (const days of [3, 7, 14, 30, 60, 60]) {
      const r = await review(true);
      expect(
        Math.round(
          (new Date(r.progress.next_review_at).getTime() - Date.now()) /
            86400000,
        ),
      ).toBe(days);
    }
    const failed = await review(false);
    expect(failed.progress.interval_index).toBe(0);
    expect(failed.progress.times_forgotten).toBe(1);
    expect(failed.progress.times_reviewed).toBe(7);
  });
  it("is idempotent for a retried review submission", async () => {
    const request = crypto.randomUUID();
    await review(true, request);
    const again = await review(true, request);
    expect(again.duplicate).toBe(true);
    expect(again.progress.times_reviewed).toBe(1);
    expect((await pg.query("select * from review_events")).rows).toHaveLength(
      1,
    );
  });
  it("does not mark a multi-sense word mastered until all senses advance", async () => {
    for (let i = 0; i < 4; i++) await review(true);
    expect(
      (await pg.query<{ status: string }>("select status from user_words"))
        .rows[0].status,
    ).toBe("reviewing");
    for (let i = 0; i < 4; i++)
      await review(true, crypto.randomUUID(), senses[1].id);
    expect(
      (await pg.query<{ status: string }>("select status from user_words"))
        .rows[0].status,
    ).toBe("mastered");
  });
  it("rejects reviews of words not saved by the caller", async () => {
    await expect(
      pg.query(
        "select public.record_review($1,$2,$3,'reverse_recall',true,'answer','feedback',100)",
        [B, crypto.randomUUID(), senses[0].id],
      ),
    ).rejects.toThrow("Word is not in your vocabulary");
  });
  it("rejects archived word reviews and preserves history on archive", async () => {
    await review(true);
    await pg.exec("update user_words set status='archived'");
    await expect(review(true)).rejects.toThrow("Word is archived");
    expect((await pg.query("select * from review_events")).rows).toHaveLength(
      1,
    );
  });
  it("deletes only the personal word, history and progress", async () => {
    await pg.query("select public.save_lexical_word($1,$2,'','','')", [
      B,
      JSON.stringify(entry),
    ]);
    await review(true);
    await pg.query("select public.delete_user_word($1,$2)", [A, wid]);
    expect((await pg.query("select * from words")).rows).toHaveLength(1);
    expect((await pg.query("select * from user_words")).rows).toHaveLength(1);
    expect(
      (await pg.query("select * from user_sense_progress")).rows,
    ).toHaveLength(2);
    expect((await pg.query("select * from review_events")).rows).toHaveLength(
      0,
    );
  });
  it("rejects an invalid reminder timezone", async () => {
    await expect(
      pg.exec("update reminder_preferences set timezone='not/a-zone'"),
    ).rejects.toThrow("Invalid timezone");
  });
  it("filters meaning search to the caller’s own active vocabulary", async () => {
    expect(
      (
        await pg.query("select * from hybrid_search($1,'careful',null,true)", [
          A,
        ])
      ).rows.length,
    ).toBeGreaterThan(0);
    expect(
      (
        await pg.query("select * from hybrid_search($1,'careful',null,true)", [
          B,
        ])
      ).rows,
    ).toHaveLength(0);
  });
});
describe("row-level security and privilege boundaries", () => {
  it("isolates vocabulary, profile, progress and review history", async () => {
    await review(true);
    await asUser(B);
    expect((await pg.query("select * from user_words")).rows).toHaveLength(0);
    expect(
      (await pg.query("select * from user_sense_progress")).rows,
    ).toHaveLength(0);
    expect((await pg.query("select * from review_events")).rows).toHaveLength(
      0,
    );
    expect(
      (await pg.query<{ id: string }>("select id from profiles")).rows.map(
        (r) => r.id,
      ),
    ).toEqual([B]);
  });
  it("denies direct client writes to review history and canonical entries", async () => {
    await asUser(A);
    await expect(
      pg.query("update user_sense_progress set recall_score=100"),
    ).rejects.toThrow("permission denied");
    await expect(
      pg.exec(
        "insert into words(word,normalized_word) values('attack','attack')",
      ),
    ).rejects.toThrow("permission denied");
  });
  it("denies calls to privileged user-ID RPCs", async () => {
    await asUser(B);
    await expect(
      pg.query("select public.delete_user_word($1,$2)", [A, wid]),
    ).rejects.toThrow("permission denied");
    await expect(
      pg.query("select public.hybrid_search($1,'careful',null,true)", [A]),
    ).rejects.toThrow("permission denied");
  });
  it("prevents changing a saved word’s owner or canonical reference", async () => {
    await asUser(A);
    await expect(
      pg.query("update user_words set user_id=$1", [B]),
    ).rejects.toThrow("permission denied");
    await expect(
      pg.query("update user_words set word_id=$1", [crypto.randomUUID()]),
    ).rejects.toThrow("permission denied");
  });
  it("protects messages through ownership of their parent session", async () => {
    const s = (
      await pg.query<{ id: string }>(
        "insert into ai_sessions(user_id,title) values($1,'private') returning id",
        [A],
      )
    ).rows[0];
    await pg.query(
      "insert into ai_messages(session_id,role,content) values($1,'user','private message')",
      [s.id],
    );
    await asUser(B);
    expect((await pg.query("select * from ai_messages")).rows).toHaveLength(0);
    await pg.exec("reset role");
    await asUser(A);
    expect((await pg.query("select * from ai_messages")).rows).toHaveLength(1);
  });
});
