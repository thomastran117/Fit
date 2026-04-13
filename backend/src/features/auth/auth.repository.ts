export interface AuthSessionRecord {
  userId: string;
  sessionId: string;
  email?: string;
  role?: string;
  deviceId?: string;
}

export class AuthRepository {
  async findSessionByUserId(userId: string): Promise<AuthSessionRecord | null> {
    return {
      userId,
      sessionId: `session:${userId}`,
    };
  }
}
