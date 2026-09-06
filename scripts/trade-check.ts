/**
 * Trading records, and the three ways it could go wrong quietly.
 *
 * 1. THE PRIVILEGE. Accepting a trade writes a row onto the OTHER
 *    person's shelf, which their own row level security correctly stops
 *    anybody else from doing. So accept runs as the service role, and the
 *    only thing between a form post and writing to a stranger's shelf is
 *    one hand-written check that the caller is the holder. If that check
 *    ever moves below the privileged client, anybody can hand anybody
 *    anything.
 *
 * 2. THE ORDER. The two shelf rows go first and the trade is settled
 *    last. The worst case then is a trade that still reads as open with
 *    the records already delivered, which somebody can see and act on.
 *    Settling first and failing halfway leaves a trade marked done with
 *    nothing handed over, which is the version nobody can tell from
 *    working.
 *
 * 3. THE PRIVACY. Your shelf is private. Nothing here may read it, and
 *    the offer form is typed rather than picked for exactly that reason.
 *
 * The wording is checked too, because the same row is two different
 * sentences depending on which side of it you are on, and getting that
 * backwards tells somebody they turned down a record they wanted.
 */
import { readFileSync } from "node:fs";
import { describeTrade, myOffers, theirOffers, cleanNote, MAX_TRADE_NOTE, type Trade, type Offer } from "../src/lib/trades";

let failed = 0;
const ok = (m: string) => console.log(`ok    ${m}`);
const bad = (m: string) => {
  failed++;
  console.log(`FAIL  ${m}`);
};
function eq<T>(a: T, b: T, what: string) {
  if (JSON.stringify(a) === JSON.stringify(b)) ok(what);
  else bad(`${what} - got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
}

/**
 * Comments blanked, line count kept.
 *
 * Without this every assertion below is really asking "does the file
 * mention this", and a comment explaining why we do NOT do a thing reads
 * exactly like doing it. The onConflict check failed on its own
 * explanation the first time it ran.
 */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//");
      return at >= 0 && !/["'`]/.test(line.slice(0, at)) ? line.slice(0, at) : line;
    })
    .join("\n");
}

const actions = code("src/app/actions/trades.ts");

// ---- 1. The holder check comes before the privileged client ----
const holderCheck = actions.indexOf("trade.holder_id !== user.id");
const adminClient = actions.indexOf("createAdminClient()");
if (holderCheck < 0) {
  bad("accept never checks that the caller is the holder, so anybody who can post the form can settle anybody's trade");
} else if (adminClient < 0) {
  bad("accept does not use the service role client, so it cannot write the other person's half and will half-complete every trade");
} else if (holderCheck < adminClient) {
  ok("the holder check runs before the privileged client is even created, so a stranger's form post stops there");
} else {
  bad("the service role client is created before the caller is checked to be the holder - reorder these, the check is the only thing guarding it");
}

// ---- 2. Deliver, then settle ----
const shelfWrite = actions.indexOf('.from("queue_items")');
const settle = actions.indexOf('status: "accepted"');
if (shelfWrite > 0 && settle > 0 && shelfWrite < settle) {
  ok("the records are handed over before the trade is marked done, so a failure leaves it open rather than leaving it done with nothing swapped");
} else {
  bad("the trade is settled before the records are handed over - a failure in between marks a trade complete that never happened");
}
if (/error\.code !== "23505"\)\s*return;/.test(actions)) {
  ok("a record already on somebody's shelf is forgiven rather than failing the trade, and anything else stops it");
} else {
  bad("the shelf insert does not distinguish 'they already have it' from a real failure");
}
// The shelf's unique index is on lower(title), which onConflict cannot name.
if (!/onConflict/.test(actions)) {
  ok("nothing tries to upsert onto the shelf - its unique index is on lower(title) and onConflict cannot name a functional index");
} else {
  bad("an upsert with onConflict is aiming at an index that does not exist under that name; use an insert and forgive 23505");
}

// ---- 3. Nothing reads a private shelf to build the table ----
const lib = code("src/lib/trades.ts");
const page = code("src/app/trades/page.tsx");
if (!/queue_items/.test(lib) && !/queue_items/.test(page)) {
  ok("neither the trading table nor its library reads anybody's shelf, which is what keeps the shelf private");
} else {
  bad("something on the trading table reads queue_items - the shelf is private and putting a record up is meant to be the only thing that exposes one");
}

// ---- The holder is worked out, not submitted ----
if (/holder_id: wants\.user_id/.test(actions)) {
  ok("the holder is read off the record being asked for, not taken from the form, so a proposal cannot be addressed to an uninvolved person");
} else {
  bad("holder_id comes from somewhere other than the record's own owner");
}

// ---- The rule that makes it a trade ----
for (const [field, message] of [["wants_offer_id", "the record you want"], ["gives_offer_id", "one of yours to offer"]]) {
  if (actions.includes(field)) ok(`a proposal needs ${message}`);
  else bad(`a proposal does not require ${field}, which makes it a wish list rather than a trade`);
}

// ---- Both sentences of the same row ----
const offer = (id: string, title: string): Offer => ({
  id, userId: id, username: "someone", avatarUrl: null, title,
  artist: null, imageUrl: null, note: null, createdAt: "",
});
const trade: Trade = {
  id: "t1", status: "open", note: null, createdAt: "",
  wants: offer("a", "Rumours"), gives: offer("b", "Kid A"),
  proposerId: "me", holderId: "them",
};
const asAsker = describeTrade(trade, "me");
const asHolder = describeTrade(trade, "them");
if (asAsker !== asHolder) ok("a trade reads differently from each side, which is the whole point of describing it at all");
else bad("both sides get the same sentence");
if (asAsker.includes("Rumours") && asAsker.includes("Kid A")) ok("the asker's line names what they want and what it costs");
else bad(`the asker's line is missing one of the two records: ${asAsker}`);

const declined: Trade = { ...trade, status: "declined" };
if (describeTrade(declined, "me").startsWith("They kept")) ok("a decline reads as them keeping theirs, not as you having done something");
else bad(`a decline reads wrong to the asker: ${describeTrade(declined, "me")}`);
if (describeTrade(declined, "them").startsWith("You kept")) ok("and reads as your own decision to the person who made it");
else bad(`a decline reads wrong to the holder: ${describeTrade(declined, "them")}`);

// ---- Splitting the table ----
const table = [offer("mine", "Aja"), offer("yours", "Heat")];
table[0].userId = "me";
table[1].userId = "you";
eq(myOffers(table, "me").map((o) => o.title), ["Aja"], "your own records are told apart from everybody else's");
eq(theirOffers(table, "me").map((o) => o.title), ["Heat"], "and the table you can ask from excludes your own");
eq(myOffers(table, null).length, 0, "a signed out visitor owns nothing on the table");

// ---- Notes ----
eq(cleanNote("  "), null, "an empty note is no note");
eq(cleanNote("x".repeat(400))?.length, MAX_TRADE_NOTE, "a long note is cut to the limit rather than rejected");

console.log(failed === 0 ? "\nOne of mine for one of yours, and nobody can take without giving." : `\n${failed} problem(s).`);
process.exit(failed === 0 ? 0 : 1);
