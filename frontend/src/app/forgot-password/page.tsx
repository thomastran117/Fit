import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ForgotPasswordFormCard } from "@/components/auth/forgot-password-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "Forgot Password | Rentify",
  description:
    "Reset your Rentify password with an emailed code and get back to your listings, bookings, and conversations.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell variant="forgot-password">
      <ForgotPasswordFormCard>
        <ForgotPasswordForm />
      </ForgotPasswordFormCard>
    </AuthPageShell>
  );
}
