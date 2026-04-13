import {
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  getDatabaseClient,
  type databaseClient,
} from "@/configuration/resources/database";

type DatabaseClient = NonNullable<typeof databaseClient>;

export interface RetryOptions {
  backoffMultiplier?: number;
  deadlineMs?: number;
  initialDelayMs?: number;
  jitterMs?: number;
  maxDelayMs?: number;
  maxRetries?: number;
  retryableCodes?: string[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  backoffMultiplier: 2,
  deadlineMs: 10_000,
  initialDelayMs: 100,
  jitterMs: 50,
  maxDelayMs: 2_000,
  maxRetries: 3,
  retryableCodes: ["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"],
};

const TRANSIENT_ERROR_NAMES = new Set([
  "AbortError",
  "PrismaClientInitializationError",
  "PrismaClientRustPanicError",
  "PrismaClientUnknownRequestError",
]);

const TRANSIENT_NODE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "PROTOCOL_CONNECTION_LOST",
]);

export abstract class BaseRepository {
  protected readonly database: DatabaseClient;

  constructor(database: DatabaseClient = getDatabaseClient()) {
    this.database = database;
  }

  protected async executeAsync<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    const settings = {
      ...DEFAULT_RETRY_OPTIONS,
      ...options,
    };
    const startedAt = Date.now();

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= settings.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (
          attempt === settings.maxRetries ||
          !this.isTransientError(error, settings) ||
          this.hasReachedDeadline(startedAt, settings)
        ) {
          throw error;
        }

        const delayMs = this.calculateDelay(attempt, settings);

        if (this.willExceedDeadline(startedAt, delayMs, settings)) {
          throw error;
        }

        await this.sleep(delayMs);
        attempt += 1;
      }
    }

    throw lastError;
  }

  protected get prisma(): PrismaClient {
    return this.database;
  }

  private isTransientError(
    error: unknown,
    options: Required<RetryOptions>,
  ): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return options.retryableCodes.includes(error.code);
    }

    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return true;
    }

    if (error instanceof Error && TRANSIENT_ERROR_NAMES.has(error.name)) {
      return true;
    }

    const errorCode = this.readErrorCode(error);

    if (!errorCode) {
      return false;
    }

    return TRANSIENT_NODE_ERROR_CODES.has(errorCode);
  }

  private readErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return undefined;
    }

    const { code } = error as { code?: unknown };
    return typeof code === "string" ? code : undefined;
  }

  private calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = Math.min(
      options.initialDelayMs * options.backoffMultiplier ** attempt,
      options.maxDelayMs,
    );
    const jitter = Math.floor(Math.random() * options.jitterMs);

    return exponentialDelay + jitter;
  }

  private hasReachedDeadline(
    startedAt: number,
    options: Required<RetryOptions>,
  ): boolean {
    return Date.now() - startedAt >= options.deadlineMs;
  }

  private willExceedDeadline(
    startedAt: number,
    nextDelayMs: number,
    options: Required<RetryOptions>,
  ): boolean {
    return Date.now() - startedAt + nextDelayMs >= options.deadlineMs;
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
}
