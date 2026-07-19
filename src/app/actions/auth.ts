"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

export type AuthFormState = {
  error?: string;
  message?: string;
  hint?: "no-account";
};

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const birthdate = String(formData.get("birthdate") ?? "").trim();
  const termsAccepted = formData.get("terms_accepted") === "on";

  if (!email || !password || !username || !birthdate) {
    return { error: "Email, username, password, and birthdate are all required." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (!termsAccepted) {
    return { error: "You must agree to the Privacy Policy and Terms of Service." };
  }

  const birthDate = new Date(birthdate);
  if (Number.isNaN(birthDate.getTime())) {
    return { error: "Enter a valid birthdate." };
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  if (age < 13) {
    return { error: "You must be at least 13 years old to create an account." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existing) {
    return { error: "That username is already taken." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, birthdate },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("database error saving new user")) {
      return { error: "That username is already taken." };
    }
    return { error: error.message };
  }

  if (!data.session) {
    return { message: "Check your email to confirm your account, then sign in." };
  }

  // Any nav links prefetched while signed out are still sitting in the
  // client router cache — invalidate the whole layout so every route
  // picks up the new session on next visit, not just "/".
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return {
        error:
          "That email/password combination didn't match an account. Double-check them, or create an account if you're new here.",
        hint: "no-account",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithMagicLink(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter an email address first." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });

  if (error) {
    return { error: error.message };
  }

  return { message: "Check your email for a magic sign-in link." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
