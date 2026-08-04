"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site";
import { checkUsernameSafety } from "@/lib/contentSafety";
import { sendEmail, FROM_NEWSLETTER } from "@/lib/email";
import {
  renderConfirmEmail,
  renderWelcomeEmail,
  renderResetEmail,
  renderMagicLinkEmail,
} from "@/lib/emailTemplates";

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

  // Deliberately NOT supabase.auth.signUp() - that makes Supabase send its
  // own plain default confirmation email. generateLink creates the user and
  // hands back a confirmation token WITHOUT sending anything, so we can send
  // our own branded template through Resend instead.
  const admin = createAdminClient();
  let linkData: Awaited<ReturnType<typeof admin.auth.admin.generateLink>>["data"];
  let linkError: Awaited<ReturnType<typeof admin.auth.admin.generateLink>>["error"];
  try {
    const res = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { data: { username, birthdate } },
    });
    linkData = res.data;
    linkError = res.error;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[signUp] generateLink threw: ${message}`);
    return { error: `Something went wrong creating your account. Please try again. (${message})` };
  }

  if (linkError) {
    console.error(
      `[signUp] generateLink error: status=${linkError.status} code=${linkError.code} message=${linkError.message}`
    );
    const lower = (linkError.message ?? "").toLowerCase();
    if (lower.includes("already been registered") || lower.includes("already exists")) {
      return { error: "An account with that email already exists. Try signing in instead." };
    }
    if (lower.includes("database error saving new user")) {
      return { error: "That username is already taken." };
    }
    return { error: linkError.message || `Sign up failed (status ${linkError.status ?? "unknown"}).` };
  }

  const hashedToken = linkData?.properties?.hashed_token;
  const newUserId = linkData?.user?.id;
  if (!hashedToken) {
    console.error("[signUp] generateLink returned no hashed_token");
    return { error: "Couldn't generate a confirmation link. Please try again." };
  }

  // Point at our own callback with the token hash rather than Supabase's
  // action_link. Our route verifies it server-side and writes the session
  // cookies, so confirming the email signs them straight in.
  const confirmUrl = `${siteUrl()}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=signup`;

  const confirmSend = await sendEmail("Confirm your Feedback account", renderConfirmEmail(confirmUrl), email);
  if (!confirmSend.ok) {
    // The account exists but they'd never get the link and couldn't retry
    // with the same email - roll it back so the retry works.
    console.error(`[signUp] confirmation email failed, rolling back user: ${confirmSend.error}`);
    if (newUserId) await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return { error: `We couldn't send your confirmation email: ${confirmSend.error}` };
  }

  // Subscribe them to the weekly newsletter and send the welcome issue.
  // Best-effort: a failure here must not break an otherwise good signup.
  const { error: subError } = await admin
    .from("newsletter_subscribers")
    .upsert({ email, user_id: newUserId ?? null, source: "signup" }, { onConflict: "email" });
  if (subError) console.error(`[signUp] newsletter subscribe failed: ${subError.message}`);

  // Sent from the newsletter address, not the transactional one - this is
  // the newsletter's own welcome, and the reply-to/filtering expectations
  // that come with it should match.
  const welcomeSend = await sendEmail(
    "Welcome to Feedback",
    renderWelcomeEmail(username, siteUrl()),
    email,
    { from: FROM_NEWSLETTER }
  );
  if (!welcomeSend.ok) console.error(`[signUp] welcome email failed: ${welcomeSend.error}`);

  return { message: "Check your email to confirm your account - the link signs you straight in." };
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

  // Same approach as signup: generate the token ourselves and send our own
  // email, so the link points straight at our callback instead of bouncing
  // through Supabase's verify endpoint (which silently drops users on the
  // site's home page when the redirect URL isn't allowlisted).
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });

  if (error || !data?.properties?.hashed_token) {
    console.error(`[magicLink] generateLink failed: ${error?.message ?? "no hashed_token"}`);
    // Don't confirm whether the address has an account.
    return { message: "Check your email for a magic sign-in link." };
  }

  const loginUrl = `${siteUrl()}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink`;
  const send = await sendEmail("Your Feedback sign-in link", renderMagicLinkEmail(loginUrl), email);
  if (!send.ok) {
    console.error(`[magicLink] send failed: ${send.error}`);
    return { error: `We couldn't send your sign-in link: ${send.error}` };
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

  // Generate the recovery token ourselves and send our own branded email.
  // supabase.auth.resetPasswordForEmail() sends Supabase's default email,
  // whose link goes to Supabase's verify endpoint first - and if the
  // redirect URL isn't in the project's allowlist, Supabase quietly falls
  // back to the Site URL, dumping the user on the home page instead of the
  // reset form. Our own link skips that hop entirely.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });

  if (error || !data?.properties?.hashed_token) {
    // Log it, but never tell the caller - that would reveal whether the
    // address has an account.
    console.error(`[passwordReset] generateLink failed: ${error?.message ?? "no hashed_token"}`);
    return { message: genericMessage };
  }

  const resetUrl = `${siteUrl()}/auth/callback?token_hash=${encodeURIComponent(
    data.properties.hashed_token
  )}&type=recovery&next=${encodeURIComponent("/reset-password")}`;

  const send = await sendEmail("Reset your Feedback password", renderResetEmail(resetUrl), email);
  if (!send.ok) console.error(`[passwordReset] send failed: ${send.error}`);

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
