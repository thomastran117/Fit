import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  type AuthSessionRecord,
  type AuthUserRecord,
  type LocalSignupRequest,
} from "@/features/auth/auth.model";

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

export class AuthRepository {
  constructor(private readonly database: PrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.database.authUser.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!user) {
      return null;
    }

    return this.mapUser(user);
  }

  async createLocalUser(
    input: LocalSignupRequest,
    passwordHash: string,
  ): Promise<AuthUserRecord> {
    const user = await this.database.authUser.create({
      data: {
        id: randomUUID(),
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        role: "user",
        emailVerified: false,
      },
    });

    return this.mapUser(user);
  }

  async createSession(user: AuthUserRecord, deviceId?: string): Promise<AuthSessionRecord> {
    return {
      userId: user.id,
      sessionId: randomUUID(),
      email: user.email,
      role: user.role,
      deviceId,
    };
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
