import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { BaseRepository } from "@/features/base/base.repository";
import {
  type CreateLocalUserInput,
  type AuthUserRecord,
  type UserProfileRecord,
} from "@/features/auth/auth.model";
import type { VerifiedOAuthProfile } from "@/features/auth/oauth/oauth.types";
import ConflictError from "@/errors/http/conflict.error";

type AuthUserPersistence = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  emailVerified: boolean;
  profile: AuthProfilePersistence | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuthProfilePersistence = {
  id: string;
  userId: string;
  username: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  avatarBlobName: string | null;
  isPrivate: boolean;
  trustworthinessScore: number;
  rentPostingsCount: number;
  availableRentPostingsCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export class AuthRepository extends BaseRepository {
  async findUserById(id: string): Promise<AuthUserRecord | null> {
    const user = await this.executeAsync(() =>
      this.prisma.user.findUnique({
        where: {
          id,
        },
        include: {
          profile: true,
        },
      }),
    );

    if (!user) {
      return null;
    }

    return this.mapUser(user);
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.executeAsync(() =>
      this.prisma.user.findUnique({
        where: {
          email: email.toLowerCase(),
        },
        include: {
          profile: true,
        },
      }),
    );

    if (!user) {
      return null;
    }

    return this.mapUser(user);
  }

  async createLocalUser(
    input: CreateLocalUserInput,
    passwordHash: string,
  ): Promise<AuthUserRecord> {
    const username = await this.generateAvailableUsername(input.email);

    const user = await this.executeAsync(() =>
      this.prisma.user.create({
        data: {
          id: randomUUID(),
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          role: "user",
          emailVerified: false,
          profile: {
            create: {
              id: randomUUID(),
              username,
            },
          },
        },
        include: {
          profile: true,
        },
      }),
    );

    return this.mapUser(user);
  }

  async createOAuthUser(input: VerifiedOAuthProfile): Promise<AuthUserRecord> {
    const username = await this.generateAvailableUsername(input.email);

    const user = await this.executeAsync(() =>
      this.prisma.user.create({
        data: {
          id: randomUUID(),
          email: input.email.toLowerCase(),
          passwordHash: `oauth:${input.provider}:${input.providerUserId}`,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          role: "user",
          emailVerified: input.emailVerified,
          profile: {
            create: {
              id: randomUUID(),
              username,
            },
          },
        },
        include: {
          profile: true,
        },
      }),
    );

    return this.mapUser(user);
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          emailVerified: true,
        },
      }),
    );
  }

  private mapUser(user: AuthUserPersistence): AuthUserRecord {
    if (!user.profile) {
      throw new ConflictError("User profile is missing for the authenticated account.");
    }

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      role: user.role,
      emailVerified: user.emailVerified,
      profile: this.mapProfile(user.profile),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private mapProfile(profile: AuthProfilePersistence): UserProfileRecord {
    return {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      phoneNumber: profile.phoneNumber ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      avatarBlobName: profile.avatarBlobName ?? undefined,
      isPrivate: profile.isPrivate,
      trustworthinessScore: profile.trustworthinessScore,
      rentPostingsCount: profile.rentPostingsCount,
      availableRentPostingsCount: profile.availableRentPostingsCount,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private async generateAvailableUsername(email: string): Promise<string> {
    const [localPart] = email.toLowerCase().split("@");
    const baseUsername = this.sanitizeUsername(localPart || "user");

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const suffix = attempt === 0 ? "" : `${attempt + 1}`;
      const candidate = `${baseUsername}${suffix}`.slice(0, 50);
      const existingProfile = await this.executeAsync(() =>
        this.prisma.profile.findUnique({
          where: {
            username: candidate,
          },
          select: {
            id: true,
          },
        }),
      );

      if (!existingProfile) {
        return candidate;
      }
    }

    return `${baseUsername.slice(0, 41)}-${randomUUID().slice(0, 8)}`;
  }

  private sanitizeUsername(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "");

    return normalized.slice(0, 50) || "user";
  }
}
