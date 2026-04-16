import type { Metadata } from "next";
import { LoginPageShell } from "@/components/auth/login-page-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { SignupFormCard } from "@/components/auth/signup-form-card";

export const metadata: Metadata = {
  title: "Sign Up | Rentify",
  description:
    "Create your Rentify account to manage rental listings, bookings, and guest conversations in one place.",
  openGraph: {
    title: "Sign Up | Rentify",
    description:
      "Create your Rentify account to manage rental listings, bookings, and guest conversations in one place.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sign Up | Rentify",
    description:
      "Create your Rentify account to manage rental listings, bookings, and guest conversations in one place.",
  },
};

export default function SignupPage() {
  return (
    <LoginPageShell>
      <SignupFormCard>
        <SignupForm />
      </SignupFormCard>
    </LoginPageShell>
  );
}
