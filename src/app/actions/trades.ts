"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyDbError, isMissingSchema } from "@/lib/dbError";
import { cleanNote } from "@/lib/trades";

export type TradeState = { error?: string; ok?: boolean };

const NOT_SET_UP = "Trading isn't set up yet. Run migration 014.";

/** Puts one record from your shelf out on the table. */
export async function offerRecord(_prev: TradeState, formData: FormData): Promise<TradeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You have to be signed in to trade." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Nothing to put up." };

  const { error } = await supabase.from("crate_offers").insert({
    user_id: user.id,
    title,
    artist: String(formData.get("artist") ?? "").trim() || null,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    note: cleanNote(formData.get("note")),
  });

  // 23505 is the partial unique index: it is already on the table. Putting
  // the same record up twice is forgetting, not an error.
  if (error && error.code !== "23505") {
    if (isMissingSchema(error.message)) return { error: NOT_SET_UP };
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath("/trades");
  return { ok: true };
}

/** Takes one of your own records back off the table. */
export async function withdrawOffer(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(formData.get("offer_id") ?? "").trim();
  if (!id) return;

  // Closed rather than deleted, so a settled trade can still show what
  // was swapped. RLS already limits this to your own rows; the user_id
  // filter is here so a wrong id fails quietly rather than throwing.
  await supabase
    .from("crate_offers")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("closed_at", null);

  revalidatePath("/trades");
}

/** Offers one of yours for one of theirs. */
export async function proposeTrade(_prev: TradeState, formData: FormData): Promise<TradeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You have to be signed in to trade." };

  const wantsId = String(formData.get("wants_offer_id") ?? "").trim();
  const givesId = String(formData.get("gives_offer_id") ?? "").trim();
  if (!wantsId) return { error: "Pick the record you want." };
  if (!givesId) return { error: "Pick one of yours to offer for it." };
  if (wantsId === givesId) return { error: "That is the same record." };

  // Both offers are read back before anything is written, because the
  // holder is worked out from the record rather than taken from the
  // form. Trusting a hidden field for that would let somebody address a
  // proposal to a person who has nothing to do with it.
  const { data: offers, error: readError } = await supabase
    .from("crate_offers")
    .select("id, user_id, closed_at")
    .in("id", [wantsId, givesId])
    .returns<{ id: string; user_id: string; closed_at: string | null }[]>();

  if (readError) {
    if (isMissingSchema(readError.message)) return { error: NOT_SET_UP };
    return { error: friendlyDbError(readError.message) };
  }

  const wants = offers?.find((o) => o.id === wantsId);
  const gives = offers?.find((o) => o.id === givesId);
  if (!wants || !gives) return { error: "One of those is not on the table any more." };
  if (wants.closed_at || gives.closed_at) {
    return { error: "One of those has already gone. Try another." };
  }
  if (gives.user_id !== user.id) return { error: "You can only offer your own records." };
  if (wants.user_id === user.id) return { error: "That one is already yours." };

  const { error } = await supabase.from("crate_trades").insert({
    proposer_id: user.id,
    holder_id: wants.user_id,
    wants_offer_id: wantsId,
    gives_offer_id: givesId,
    note: cleanNote(formData.get("note")),
  });

  // Same reasoning as the offer: asking twice with the same two records
  // is nagging, and the index turns it into a no-op.
  if (error && error.code !== "23505") {
    if (isMissingSchema(error.message)) return { error: NOT_SET_UP };
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath("/trades");
  return { ok: true };
}

/**
 * Says yes.
 *
 * This is the only privileged action here, and it has to be: accepting
 * writes a row onto the OTHER person's shelf, which their own row level
 * security correctly forbids anybody else from doing. So the caller is
 * checked to be the holder first, by hand, and only then does the
 * service role client finish the job.
 *
 * Order matters. The two shelf rows go first and the trade is settled
 * last, so the worst case is a trade that still reads as open with the
 * records already delivered - which somebody can see and act on. Settling
 * first and failing halfway would leave a trade marked done with nothing
 * handed over, which is the version nobody can tell from working.
 */
export async function acceptTrade(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(formData.get("trade_id") ?? "").trim();
  if (!id) return;

  const { data: trade } = await supabase
    .from("crate_trades")
    .select(
      `id, status, proposer_id, holder_id,
       wants:wants_offer_id ( id, user_id, title, artist, image_url ),
       gives:gives_offer_id ( id, user_id, title, artist, image_url )`
    )
    .eq("id", id)
    .maybeSingle();

  if (!trade || trade.status !== "open") return;
  // The check the whole action rests on. Everything below runs as the
  // service role, so this is the only thing standing between a form post
  // and writing to somebody else's shelf.
  if (trade.holder_id !== user.id) return;

  const wants = Array.isArray(trade.wants) ? trade.wants[0] : trade.wants;
  const gives = Array.isArray(trade.gives) ? trade.gives[0] : trade.gives;
  if (!wants || !gives) return;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Each side gets the other's record.
  //
  // Inserted one at a time with 23505 forgiven, rather than as an upsert
  // with onConflict. The shelf's unique index is on (user_id,
  // media_type, lower(title)) and onConflict cannot name a functional
  // index, so an upsert here would either fail outright or, worse,
  // silently target nothing. Forgiving the duplicate is also the right
  // behaviour: if it is already on their shelf then the trade has
  // nothing to add, and it must not overwrite the row they already had.
  const shelfRows = [
    {
      user_id: trade.proposer_id,
      media_type: "music",
      title: wants.title,
      subtitle: wants.artist,
      image_url: wants.image_url,
    },
    {
      user_id: trade.holder_id,
      media_type: "music",
      title: gives.title,
      subtitle: gives.artist,
      image_url: gives.image_url,
    },
  ];
  for (const row of shelfRows) {
    const { error } = await admin.from("queue_items").insert(row);
    // Anything other than "they already have it" means nothing was
    // handed over, so nothing gets settled: the trade stays open and can
    // be accepted again.
    if (error && error.code !== "23505") return;
  }

  // Both records leave the table.
  await admin
    .from("crate_offers")
    .update({ closed_at: now })
    .in("id", [wants.id, gives.id]);

  await admin
    .from("crate_trades")
    .update({ status: "accepted", settled_at: now })
    .eq("id", id)
    .eq("status", "open");

  revalidatePath("/trades");
  revalidatePath("/queue");
}

/** Says no, or takes an offer back. Which of the two depends on who asks. */
export async function settleTrade(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(formData.get("trade_id") ?? "").trim();
  if (!id) return;

  const { data: trade } = await supabase
    .from("crate_trades")
    .select("id, status, proposer_id, holder_id")
    .eq("id", id)
    .maybeSingle();
  if (!trade || trade.status !== "open") return;

  // The holder declining and the proposer changing their mind are
  // different things to read back in a list, so they are different
  // words rather than one "closed".
  const status =
    trade.holder_id === user.id ? "declined" : trade.proposer_id === user.id ? "withdrawn" : null;
  if (!status) return;

  await supabase
    .from("crate_trades")
    .update({ status, settled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open");

  revalidatePath("/trades");
}
