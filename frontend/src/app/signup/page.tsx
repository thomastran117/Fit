import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { SignupFormCard } from "@/components/auth/signup-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

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
    <AuthPageShell variant="signup">
      <SignupFormCard>
        <SignupForm />
      </SignupFormCard>
    </AuthPageShell>
  );
}
