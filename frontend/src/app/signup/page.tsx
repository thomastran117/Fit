import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign Up | Rentify",
  description: "Create your Rentify account.",
};

export default function SignupPage() {
  return <SignupForm />;
}
