"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { checkUsernameSafety } from "@/lib/contentSafety";

export type AuthFormState = {
  error?: string;
  message?: string;
  hint?: "no-account";
};

function isRedirectSignal(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT");
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  try {
    return await signUpInner(formData);
  } catch (err) {
    if (isRedirectSignal(err)) throw err;
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error(`[signUp] unexpected throw: ${message}`);
    return { error: `Unexpected error creating your account: ${message}` };
  }
}

async function signUpInner(formData: FormData): Promise<AuthFormState> {
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
  const usernameSafety = checkUsernameSafety(username);
  if (!usernameSafety.allowed) {
    return { error: usernameSafety.reason };
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

  // The Supabase calls below are the only things in this action that can
  // throw unexpectedly (network hiccup, etc.) - guarded separately from
  // redirect() further down, since redirect() works by throwing a special
  // Next.js control-flow signal that a wrapping try/catch must never
  // swallow (doing so silently breaks the redirect and shows the caught
  // "error" instead).
  let existing: { id: string } | null;
  try {
    const res = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
    existing = res.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[signUp] username lookup threw: ${message}`);
    return { error: `Something went wrong checking that username. Please try again. (${message})` };
  }
  if (existing) {
    return { error: "That username is already taken." };
  }

  let data: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"];
  let error: Awaited<ReturnType<typeof supabase.auth.signUp>>["error"];
  try {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, birthdate },
        emailRedirectTo: `${siteUrl()}/auth/callback`,
      },
    });
    data = res.data;
    error = res.error;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[signUp] auth.signUp threw: ${message}`);
    return { error: `Something went wrong creating your account. Please try again. (${message})` };
  }

  if (error) {
    if (error.message.toLowerCase().includes("database error saving new user")) {
      return { error: "That username is already taken." };
    }
    return { error: error.message };
  }

  // Supabase deliberately doesn't return an error for a duplicate email (to
  // avoid leaking which emails are registered) - instead data.user comes
  // back with an empty identities array. Without this check, signing up
  // with an already-used email silently "succeeds" with no account created
  // and no email sent, while showing the same message as a real signup.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: "An account with that email already exists. Try signing in instead." };
  }

  if (!data.session) {
    return { message: "Check your email to confirm your account, then sign in." };
  }

  // Any nav links prefetched while signed out are still sitting in the
  // client router cache - invalidate the whole layout so every route
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

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();

  // Always return the same generic message whether or not the email
  // matches an account - confirming/denying an email exists on a password
  // reset form is a classic account-enumeration leak.
  const genericMessage = "If an account exists for that email, we've sent a password reset link.";

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });

  return { message: genericMessage };
}

export async function updatePassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!password || !confirmPassword) {
    return { error: "Enter and confirm your new password." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your reset link has expired or already been used. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/sign-in?reset=success");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
