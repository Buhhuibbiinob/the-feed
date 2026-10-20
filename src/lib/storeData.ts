import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { restock } from "@/lib/storeCatalogue";
import {
  DAILY_LIMIT,
  SECTIONS,
  storeArtUrl,
  type BoardReview,
  type StoreFormat,
  type StoreItem,
  type StoreSnapshot,
  type StoreStatus,
} from "@/lib/store";

// Reading the record store: today's shelves, the viewer's crate, what
// they own, and the community board. Writes are in app/actions/store.ts.

type ItemRow = {
  id: string;
  media_type: "music" | "movie_tv";
  format: StoreFormat;
  title: string;
  artist: string | null;
  year: number | null;
  genre: string | null;
  blurb: string | null;
  artwork_url: string;
  preview_url: string | null;
  preview_label: string | null;
  store_url: string | null;
};

const ITEM_COLUMNS =
  "id, media_type, format, title, artist, year, genre, blurb, artwork_url, preview_url, preview_label, store_url";

export function toStoreItem(r: ItemRow): StoreItem {
  return {
    id: r.id,
    mediaType: r.media_type,
    format: r.format,
    title: r.title,
    artist: r.artist,
    year: r.year,
    genre: r.genre,
    blurb: r.blurb,
    art: storeArtUrl(r.artwork_url, r.format === "dvd" ? 300 : 256),
    artworkUrl: r.artwork_url,
    previewUrl: r.preview_url,
    previewLabel: r.preview_label,
    storeUrl: r.store_url,
  };
}

const EMPTY_STATUS: StoreStatus = {
  day: new Date().toISOString().slice(0, 10),
  limit: DAILY_LIMIT,
  usedToday: 0,
  inCrate: 0,
  remaining: DAILY_LIMIT,
  open: false,
  launchAt: null,
};

/**
 * Restocks in the background, after the page has been sent.
 *
 * At most one restock every ten minutes across everybody (the claim in
 * restock() sees to that), so a busy shop costs Apple a dozen lookups
 * every ten minutes rather than one per visitor. Without the service
 * role key there is no restock, and the shop sells what it has.
 */
function restockLater() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  after(async () => {
    try {
      await restock(createAdminClient());
    } catch {
      // A failed restock is a shop with yesterday's catalogue, not an error page.
    }
  });
}

export async function getStoreStatus(supabase: SupabaseClient): Promise<StoreStatus> {
  const { data, error } = await supabase.rpc("store_status");
  if (error || !data) return EMPTY_STATUS;
  return data as StoreStatus;
}

/**
 * Everything the 3D shop needs for one visit. Null when the store's
 * tables are not there yet (migration 022 not run), so the caller can say
 * so instead of rendering an empty shop as if that were the stock.
 */
export async function loadStoreSnapshot(
  supabase: SupabaseClient,
  viewer: { id: string; username: string | null; isAdmin: boolean } | null
): Promise<StoreSnapshot | null> {
  const ensured = await supabase.rpc("store_ensure_stock");
  if (ensured.error) return null;
  restockLater();

  const status = await getStoreStatus(supabase);
  const { data: stock } = await supabase
    .from("store_stock")
    .select(`section, slot, store_items (${ITEM_COLUMNS})`)
    .eq("day", status.day)
    .order("slot")
    .returns<{ section: StoreFormat; slot: number; store_items: ItemRow | null }[]>();

  let owned: StoreItem[] = [];
  let crate: StoreItem[] = [];
  let reviewed: string[] = [];
  if (viewer) {
    const [o, c, r] = await Promise.all([
      supabase
        .from("store_owned")
        .select(`checked_out_at, store_items (${ITEM_COLUMNS})`)
        .eq("user_id", viewer.id)
        .order("checked_out_at", { ascending: false })
        .returns<{ store_items: ItemRow | null }[]>(),
      supabase
        .from("store_crate")
        .select(`added_at, store_items (${ITEM_COLUMNS})`)
        .eq("user_id", viewer.id)
        .eq("day", status.day)
        .order("added_at")
        .returns<{ store_items: ItemRow | null }[]>(),
      supabase.from("store_reviews").select("item_id").eq("user_id", viewer.id),
    ]);
    owned = (o.data ?? []).flatMap((x) => (x.store_items ? [toStoreItem(x.store_items)] : []));
    crate = (c.data ?? []).flatMap((x) => (x.store_items ? [toStoreItem(x.store_items)] : []));
    reviewed = (r.data ?? []).map((x) => x.item_id as string);
  }

  // Once something is yours it is not on your shelf. Things in the crate
  // stay listed here - the 3D shop needs their slot to put them back in -
  // and the crate list says which they are.
  const taken = new Set(owned.map((i) => i.id));
  const shelves = Object.fromEntries(SECTIONS.map((s) => [s.id, [] as StoreItem[]])) as Record<StoreFormat, StoreItem[]>;
  for (const row of stock ?? []) {
    if (!row.store_items || taken.has(row.store_items.id)) continue;
    shelves[row.section]?.push(toStoreItem(row.store_items));
  }

  return {
    status,
    shelves,
    crate,
    owned,
    reviewed,
    signedIn: !!viewer,
    username: viewer?.username ?? null,
    isAdmin: viewer?.isAdmin ?? false,
  };
}

/** The community board: reviews written in bedrooms, newest first. */
export async function loadBoard(supabase: SupabaseClient, limit = 120): Promise<BoardReview[]> {
  const { data: rows } = await supabase
    .from("store_reviews")
    .select("item_id, user_id, created_at, posts (id, rating, body, created_at)")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<
      {
        item_id: string;
        user_id: string;
        created_at: string;
        posts: { id: string; rating: number | null; body: string; created_at: string } | null;
      }[]
    >();
  if (!rows?.length) return [];

  const itemIds = [...new Set(rows.map((r) => r.item_id))];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: items }, { data: people }] = await Promise.all([
    supabase.from("store_items").select(ITEM_COLUMNS).in("id", itemIds).returns<ItemRow[]>(),
    supabase.from("profiles").select("id, username").in("id", userIds),
  ]);
  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const nameById = new Map((people ?? []).map((p) => [p.id as string, p.username as string]));

  return rows.flatMap((r) => {
    const item = itemById.get(r.item_id);
    if (!item || !r.posts) return [];
    return [
      {
        postId: r.posts.id,
        itemId: r.item_id,
        username: nameById.get(r.user_id) ?? "someone",
        title: item.title,
        artist: item.artist,
        mediaType: item.media_type,
        format: item.format,
        art: storeArtUrl(item.artwork_url, 128),
        rating: r.posts.rating,
        body: r.posts.body,
        createdAt: r.created_at,
      },
    ];
  });
}
