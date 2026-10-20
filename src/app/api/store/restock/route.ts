import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { restock } from "@/lib/storeCatalogue";

// One round of filling the record store's catalogue from Apple.
//
//   GET /api/store/restock                      as a signed-in admin, or
//   GET /api/store/restock  Authorization: Bearer $CRON_SECRET
//
// The shop also restocks itself in the background while people browse
// it (src/lib/storeData.ts), so this is for an admin who wants the
// shelves fuller sooner - before launch, say. Each call spends at most a
// dozen lookups, inside Apple's limit of about twenty a minute.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  let allowed = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!allowed) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    allowed = !!user && (await isAdmin(supabase, user.id));
  }
  if (!allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 503 });
  }
  const report = await restock(admin, { force: true });
  const { count } = await admin.from("store_items").select("id", { count: "exact", head: true }).eq("active", true);
  return NextResponse.json({ ...report, catalogue: count ?? 0 });
}
