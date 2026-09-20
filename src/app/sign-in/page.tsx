import { SignInForm } from "@/components/SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string; next?: string }>;
}) {
  const { reset, error, next } = await searchParams;
  return <SignInForm justReset={reset === "success"} linkError={error ?? null} next={next ?? null} />;
}
