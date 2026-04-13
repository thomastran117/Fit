import { randomUUID } from "node:crypto";
import type { DataSource, Repository } from "typeorm";
import {
  type AuthUserEntity,
  AuthUserEntitySchema,
} from "@/features/auth/auth-user.entity";
import {
  type AuthSessionRecord,
  type AuthUserRecord,
  type LocalSignupRequest,
} from "@/features/auth/auth.model";

export class AuthRepository {
  private readonly userRepository: Repository<AuthUserEntity>;

  constructor(private readonly database: DataSource) {
    this.userRepository = this.database.getRepository(AuthUserEntitySchema);
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.userRepository.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!user) {
      return null;
    }

    return this.mapUserEntity(user);
  }

  async createLocalUser(
    input: LocalSignupRequest,
    passwordHash: string,
  ): Promise<AuthUserRecord> {
    const user = this.userRepository.create({
      id: randomUUID(),
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      role: "user",
      emailVerified: false,
    });

    const savedUser = await this.userRepository.save(user);

    return this.mapUserEntity(savedUser);
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

  private mapUserEntity(user: AuthUserEntity): AuthUserRecord {
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
