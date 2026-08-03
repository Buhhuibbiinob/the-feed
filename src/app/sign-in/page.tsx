import { SignInForm } from "@/components/SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const { reset, error } = await searchParams;
  return <SignInForm justReset={reset === "success"} linkError={error ?? null} />;
}
