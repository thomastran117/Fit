import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ForgotPasswordFormCard } from "@/components/auth/forgot-password-form-card";
import { LoginPageShell } from "@/components/auth/login-page-shell";

export const metadata: Metadata = {
  title: "Forgot Password | Rentify",
  description:
    "Reset your Rentify password with an emailed code and get back to your listings, bookings, and conversations.",
};

export default function ForgotPasswordPage() {
  return (
    <LoginPageShell>
      <ForgotPasswordFormCard>
        <ForgotPasswordForm />
      </ForgotPasswordFormCard>
    </LoginPageShell>
  );
}
