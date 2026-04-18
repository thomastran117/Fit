import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { LoginFormCard } from "@/components/auth/login-form-card";
import { LoginPageShell } from "@/components/auth/login-page-shell";

export const metadata: Metadata = {
  title: "Login | Rentify",
  description:
    "Sign in to Rentify to manage your rental listings, bookings, and guest conversations in one place.",
  openGraph: {
    title: "Login | Rentify",
    description:
      "Sign in to Rentify to manage your rental listings, bookings, and guest conversations in one place.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Login | Rentify",
    description:
      "Sign in to Rentify to manage your rental listings, bookings, and guest conversations in one place.",
  },
};

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolvedSearchParams?.next || "/";

  return (
    <LoginPageShell>
      <LoginFormCard>
        <LoginForm nextPath={nextPath} />
      </LoginFormCard>
    </LoginPageShell>
  );
}
