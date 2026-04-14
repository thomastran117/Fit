import { randomUUID } from "node:crypto";
import { BaseRepository } from "@/features/base/base.repository";
import {
  type CreateLocalUserInput,
  type AuthUserRecord,
} from "@/features/auth/auth.model";
import type { VerifiedOAuthProfile } from "@/features/auth/oauth/oauth.types";

type AuthUserPersistence = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  emailVerified: boolean;
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
        },
      }),
    );

    return this.mapUser(user);
  }

  async createOAuthUser(input: VerifiedOAuthProfile): Promise<AuthUserRecord> {
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
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
