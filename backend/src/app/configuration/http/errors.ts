import { RequestValidationError } from "@/configuration/validation/request";

export interface ErrorResponseBody {
  error: string;
  code: string;
  details?: unknown;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized.") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden.") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

export function toErrorResponse(error: unknown): {
  status: number;
  body: ErrorResponseBody;
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof RequestValidationError) {
    return {
      status: 400,
      body: {
        error: error.message,
        code: "REQUEST_VALIDATION_ERROR",
        details: error.details,
      },
    };
  }

  if (!(error instanceof Error)) {
    return {
      status: 500,
      body: {
        error: "Internal server error.",
        code: "INTERNAL_SERVER_ERROR",
      },
    };
  }

  if (error.message === "Invalid email or password.") {
    return {
      status: 401,
      body: {
        error: error.message,
        code: "INVALID_CREDENTIALS",
      },
    };
  }

  if (error.message === "An account with this email already exists.") {
    return {
      status: 409,
      body: {
        error: error.message,
        code: "ACCOUNT_ALREADY_EXISTS",
      },
    };
  }

  if (
    error.message.includes("access token") ||
    error.message.includes("refresh token") ||
    error.message.includes("Authorization header")
  ) {
    return {
      status: 401,
      body: {
        error: error.message,
        code: "INVALID_TOKEN",
      },
    };
  }

  if (
    error.message === "A valid email is required." ||
    error.message === "Password must be at least 8 characters long."
  ) {
    return {
      status: 400,
      body: {
        error: error.message,
        code: "BAD_REQUEST",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Internal server error.",
      code: "INTERNAL_SERVER_ERROR",
    },
  };
}
