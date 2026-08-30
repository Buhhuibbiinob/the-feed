/**
 * The stickers keep rendering when the database is one migration behind.
 *
 * Naming a column that doesn't exist fails the whole select, and a failed
 * select is indistinguishable from "this profile has no stickers" - so a
 * migration nobody had run yet took every sticker, GIF and photo off
 * every profile on the site at once. This is that case, pinned down.
 *
 * Stubbed rather than run against a database on purpose: the case worth
 * testing is the one where the schema is wrong, and a real database with
 * the migration applied can't produce it.
 *
 * Run: npx tsx scripts/sticker-fallback-check.ts
 */
import { fetchStickers } from "../src/lib/stickerQuery";

type Result = { data: unknown; error: { message: string } | null };

/** Mimics the query builder: every step returns itself, the end awaits. */
function stubClient(results: Result[]) {
  const selects: string[] = [];
  let call = 0;
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "eq", "order", "returns"]) {
    builder[method] = () => builder;
  }
  builder.select = (columns: string) => {
    selects.push(columns);
    return builder;
  };
  builder.then = (resolve: (r: Result) => void) => resolve(results[call++] ?? results[results.length - 1]);
  // The stub stands in for a Supabase client, which is not a shape worth
  // reproducing in a type.
  return { client: builder as never, selects, calls: () => call };
}

const ROW = {
  id: "s1", image_url: "/cherry.gif", x: 50, y: 120,
  scale: 1, scale_y: null, rotation: 0, skew: null, z: 1,
};

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  // 1. The columns exist: one query, rows straight through.
  {
    const withMobile = { ...ROW, mobile_x: 30, mobile_y: 200 };
    const stub = stubClient([{ data: [withMobile], error: null }]);
    const rows = await fetchStickers(stub.client, "u1");
    check("columns present: sticker kept", rows.length === 1);
    check("columns present: phone position kept", rows[0]?.mobile_x === 30 && rows[0]?.mobile_y === 200);
    check("columns present: no second query", stub.calls() === 1, `${stub.calls()} queries`);
  }

  // 2. The migration has not been run. This is the regression.
  {
    const stub = stubClient([
      { data: null, error: { message: 'column profile_stickers.mobile_x does not exist' } },
      { data: [ROW], error: null },
    ]);
    const rows = await fetchStickers(stub.client, "u1");
    check("missing column: sticker still renders", rows.length === 1, `${rows.length} stickers`);
    check("missing column: falls back to the old position", rows[0]?.x === 50 && rows[0]?.y === 120);
    check("missing column: no phone position claimed", rows[0]?.mobile_x === null && rows[0]?.mobile_y === null);
    check(
      "missing column: retried without them",
      stub.selects.length === 2 && !stub.selects[1].includes("mobile_x"),
      stub.selects[1] ?? "no second query"
    );
  }

  // 3. PostgREST wording varies; the schema-cache phrasing is the same fault.
  {
    const stub = stubClient([
      { data: null, error: { message: "Could not find the 'mobile_x' column of 'profile_stickers' in the schema cache" } },
      { data: [ROW], error: null },
    ]);
    const rows = await fetchStickers(stub.client, "u1");
    check("schema cache wording: sticker still renders", rows.length === 1);
  }

  // 4. A real failure is not papered over with a second query.
  {
    const stub = stubClient([{ data: null, error: { message: "permission denied for table profile_stickers" } }]);
    const rows = await fetchStickers(stub.client, "u1");
    check("other error: no rows", rows.length === 0);
    check("other error: not retried", stub.calls() === 1, `${stub.calls()} queries`);
  }
}

main().then(() => {
  if (failures > 0) {
    console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
    process.exit(1);
  }
  console.log("\nStickers survive a database that is one migration behind.");
});
