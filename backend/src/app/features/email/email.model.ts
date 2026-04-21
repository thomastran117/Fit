import type {
  SendLoginUnlockEmailInput,
  SendNewDeviceEmailInput,
  SendPasswordResetEmailInput,
  SendVerificationEmailInput,
} from "@/features/email/email.service";

export type EmailJobKind =
  | "verification"
  | "new_device"
  | "login_unlock"
  | "password_reset";

export type EmailJobInputByKind = {
  verification: SendVerificationEmailInput;
  new_device: SendNewDeviceEmailInput;
  login_unlock: SendLoginUnlockEmailInput;
  password_reset: SendPasswordResetEmailInput;
};

export type EmailJobPayload =
  | {
      jobId: string;
      kind: "verification";
      input: SendVerificationEmailInput;
      attempt: number;
      occurredAt: string;
    }
  | {
      jobId: string;
      kind: "new_device";
      input: SendNewDeviceEmailInput;
      attempt: number;
      occurredAt: string;
    }
  | {
      jobId: string;
      kind: "login_unlock";
      input: SendLoginUnlockEmailInput;
      attempt: number;
      occurredAt: string;
    }
  | {
      jobId: string;
      kind: "password_reset";
      input: SendPasswordResetEmailInput;
      attempt: number;
      occurredAt: string;
    };
