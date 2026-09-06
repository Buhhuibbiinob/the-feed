import type { SupabaseClient } from "@supabase/supabase-js";

// Trading records out of the crate.
//
// Taking a record out of the crate puts it on your shelf, and that used
// to be the end of it. Which is only half of what a crate is for: the
// other half of digging through a box with other people is holding one
// up and asking what they will give you for it.
//
// The shape is a record fair, not a marketplace. Nothing is for sale,
// there is no currency, and you cannot ask for something without putting
// something up yourself. One of mine for one of yours, and they say yes
// or they say no.
//
// The privacy decision is the interesting one. Your shelf is private and
// stays private: nobody should have to expose everything they mean to
// listen to in order to swap one record. So putting a record on the
// table is a separate, explicit act, and only what you put up is visible.

/** Long enough to say why, short enough that it is not a review. */
export const MAX_TRADE_NOTE = 200;

export type Offer = {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  title: string;
  artist: string | null;
  imageUrl: string | null;
  note: string | null;
  createdAt: string;
};

export type TradeStatus = "open" | "accepted" | "declined" | "withdrawn";

export type Trade = {
  id: string;
  status: TradeStatus;
  note: string | null;
  createdAt: string;
  /** The record being asked for, and the one offered in exchange. */
  wants: Offer | null;
  gives: Offer | null;
  proposerId: string;
  holderId: string;
};

export function cleanNote(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, MAX_TRADE_NOTE);
}

type ProfileRef = { id: string; username: string; avatar_url: string | null };
type OfferRow = {
  id: string;
  user_id: string;
  title: string;
  artist: string | null;
  image_url: string | null;
  note: string | null;
  created_at: string;
  // Supabase types an embedded row as either shape, so both are handled
  // rather than cast away.
  profiles: ProfileRef | ProfileRef[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function toOffer(row: OfferRow): Offer {
  const person = one(row.profiles);
  return {
    id: row.id,
    userId: row.user_id,
    username: person?.username ?? "someone",
    avatarUrl: person?.avatar_url ?? null,
    title: row.title,
    artist: row.artist,
    imageUrl: row.image_url,
    note: row.note,
    createdAt: row.created_at,
  };
}

const OFFER_COLUMNS =
  "id, user_id, title, artist, image_url, note, created_at, profiles ( id, username, avatar_url )";

/**
 * Everything currently on the table, other people's first.
 *
 * Your own offers come back too, because you need to see them to know
 * what you have to trade with, and because taking one back is done from
 * the same place you put it up.
 */
export async function openOffers(
  supabase: SupabaseClient,
  { limit = 60 }: { limit?: number } = {}
): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("crate_offers")
    .select(OFFER_COLUMNS)
    .is("closed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<OfferRow[]>();
  if (error || !data) return [];
  return data.map(toOffer);
}

/**
 * Whether somebody has anything to trade with.
 *
 * Asked separately from the list because it answers a different
 * question: the table is worth showing to everybody, but the ask button
 * on somebody else's record only means anything if you have one of your
 * own to put against it.
 */
export function myOffers(offers: Offer[], userId: string | null): Offer[] {
  if (!userId) return [];
  return offers.filter((offer) => offer.userId === userId);
}

export function theirOffers(offers: Offer[], userId: string | null): Offer[] {
  return offers.filter((offer) => offer.userId !== userId);
}

type TradeRow = {
  id: string;
  status: TradeStatus;
  note: string | null;
  created_at: string;
  proposer_id: string;
  holder_id: string;
  wants: OfferRow | OfferRow[] | null;
  gives: OfferRow | OfferRow[] | null;
};

export function toTrade(row: TradeRow): Trade {
  const wants = one(row.wants);
  const gives = one(row.gives);
  return {
    id: row.id,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    wants: wants ? toOffer(wants) : null,
    gives: gives ? toOffer(gives) : null,
    proposerId: row.proposer_id,
    holderId: row.holder_id,
  };
}

/**
 * Both sides of somebody's trading, in one query.
 *
 * Asked for together rather than as an inbox and an outbox, because the
 * answer to "what is happening with my records" is one list in a
 * person's head, not two.
 */
export async function myTrades(
  supabase: SupabaseClient,
  userId: string
): Promise<{ incoming: Trade[]; outgoing: Trade[] }> {
  const { data, error } = await supabase
    .from("crate_trades")
    .select(
      `id, status, note, created_at, proposer_id, holder_id,
       wants:wants_offer_id ( ${OFFER_COLUMNS} ),
       gives:gives_offer_id ( ${OFFER_COLUMNS} )`
    )
    .or(`proposer_id.eq.${userId},holder_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .returns<TradeRow[]>();
  if (error || !data) return { incoming: [], outgoing: [] };
  const trades = data.map(toTrade);
  return {
    incoming: trades.filter((t) => t.holderId === userId),
    outgoing: trades.filter((t) => t.proposerId === userId),
  };
}

/**
 * What a trade reads as, from one side of it.
 *
 * The same row means two different sentences depending on who is looking
 * at it, and getting that wrong is how somebody reads "you turned this
 * down" about a record they wanted.
 */
export function describeTrade(trade: Trade, viewerId: string): string {
  const mine = trade.proposerId === viewerId;
  const theirs = mine ? trade.wants : trade.gives;
  const ours = mine ? trade.gives : trade.wants;
  const what = theirs?.title ?? "a record";
  const cost = ours?.title ?? "one of theirs";
  switch (trade.status) {
    case "open":
      return mine
        ? `You offered ${cost} for ${what}. Waiting on them.`
        : `They want ${theirs?.title ?? "one of yours"} and are offering ${cost}.`;
    case "accepted":
      return `Done. ${what} is yours and ${cost} is theirs.`;
    case "declined":
      return mine ? `They kept ${what}.` : `You kept ${what}.`;
    case "withdrawn":
      return mine ? "You took that offer back." : "They took that offer back.";
  }
}
