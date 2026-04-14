import { z } from "zod";

export const updateProfileRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long.")
    .max(50, "Username must be at most 50 characters long.")
    .regex(
      /^[a-z0-9._-]+$/i,
      "Username may only contain letters, numbers, periods, underscores, and hyphens.",
    ),
  phoneNumber: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 characters long.")
    .max(32, "Phone number must be at most 32 characters long.")
    .regex(/^[0-9+()\-\s]+$/, "Phone number contains unsupported characters.")
    .nullable()
    .optional(),
  avatarUrl: z.url("Avatar URL must be a valid URL.").nullable().optional(),
  avatarBlobName: z.string().trim().min(1).max(1024).nullable().optional(),
  trustworthinessScore: z
    .number()
    .int("Trustworthiness score must be an integer.")
    .min(1, "Trustworthiness score must be between 1 and 5.")
    .max(5, "Trustworthiness score must be between 1 and 5.")
    .optional(),
  rentPostingsCount: z
    .number()
    .int("Rent postings count must be an integer.")
    .min(0, "Rent postings count cannot be negative.")
    .optional(),
  availableRentPostingsCount: z
    .number()
    .int("Available rent postings count must be an integer.")
    .min(0, "Available rent postings count cannot be negative.")
    .optional(),
});

export type UpdateProfileRequestBody = z.infer<typeof updateProfileRequestSchema>;

export interface ProfileRecord {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username: string;
  phoneNumber?: string;
  avatarUrl?: string;
  avatarBlobName?: string;
  trustworthinessScore: number;
  rentPostingsCount: number;
  availableRentPostingsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  userId: string;
  username: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  avatarBlobName?: string | null;
  trustworthinessScore?: number;
  rentPostingsCount?: number;
  availableRentPostingsCount?: number;
}
