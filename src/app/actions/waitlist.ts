"use server";

import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/app/actions/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_signups").insert({ email });

  if (error) {
    if (error.code === "23505") {
      return { message: "You're already on the list!" };
    }
    return { error: "Something went wrong — try again in a bit." };
  }

  return { message: "You're on the list — we'll email you when there's news." };
}
