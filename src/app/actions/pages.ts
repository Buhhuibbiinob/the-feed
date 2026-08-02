"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { BUILTIN_PAGES } from "@/lib/pages";
import { SITE_FLAGS } from "@/lib/siteFlags";

export type PageFormState = { error?: string; ok?: boolean };

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, admin: false };
  const admin = await isAdmin(supabase, user.id);
  return { supabase, user, admin };
}

export async function setBuiltinPageArchived(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;

  const slug = String(formData.get("slug") ?? "");
  const archived = formData.get("archived") === "true";
  const builtin = BUILTIN_PAGES.find((p) => p.slug === slug);
  if (!builtin) return;

  await supabase.from("site_pages").upsert(
    {
      slug: builtin.slug,
      label: builtin.label,
      path: builtin.path,
      kind: "builtin",
      archived,
      created_by: user.id,
    },
    { onConflict: "slug" }
  );

  revalidatePath("/admin/pages");
  revalidatePath("/");
  revalidatePath(builtin.path);
}

export async function createCustomPage(
  _prevState: PageFormState,
  formData: FormData
): Promise<PageFormState> {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const label = String(formData.get("label") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim().toLowerCase();
  const content = String(formData.get("content") ?? "").trim();

  if (!label || !slugInput) return { error: "Title and URL slug are required." };
  if (!SLUG_RE.test(slugInput)) {
    return { error: "Slug can only contain lowercase letters, numbers, and single hyphens." };
  }
  if (BUILTIN_PAGES.some((p) => p.slug === slugInput)) {
    return { error: "That slug is already used by a built-in page." };
  }

  const { error } = await supabase.from("site_pages").insert({
    slug: slugInput,
    label,
    kind: "custom",
    path: `/page/${slugInput}`,
    content,
    created_by: user.id,
  });

  if (error) {
    return { error: error.code === "23505" ? "That slug is already taken." : error.message };
  }

  revalidatePath("/admin/pages");
  revalidatePath("/");
  redirect("/admin/pages");
}

export async function updateCustomPage(
  _prevState: PageFormState,
  formData: FormData
): Promise<PageFormState> {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!id || !label) return { error: "Title can't be empty." };

  const { error } = await supabase
    .from("site_pages")
    .update({ label, content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("kind", "custom");

  if (error) return { error: error.message };

  revalidatePath("/admin/pages");
  revalidatePath("/");
  return { ok: true };
}

export async function setCustomPageArchived(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;

  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  if (!id) return;

  await supabase
    .from("site_pages")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("kind", "custom");

  revalidatePath("/admin/pages");
  revalidatePath("/");
}

export async function deleteCustomPage(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("site_pages").delete().eq("id", id).eq("kind", "custom");

  revalidatePath("/admin/pages");
  revalidatePath("/");
}

export async function setSiteFlag(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;

  const key = String(formData.get("key") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!SITE_FLAGS.some((f) => f.key === key)) return;

  const { error } = await supabase
    .from("site_flags")
    .upsert({ key, enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });

  revalidatePath("/admin/pages");
  revalidatePath("/");

  if (error) {
    console.error(`[siteFlags] setSiteFlag(${key}) failed: ${error.message}`);
    redirect(`/admin/pages?error=${encodeURIComponent(error.message)}`);
  }
}
