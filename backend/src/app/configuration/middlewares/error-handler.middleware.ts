import { RequestValidationError } from "@/configuration/validation/request";
import AppError from "@/errors/http/app.error";
import type { Context } from "hono";

export interface ErrorResponseBody {
  error: string;
  code: string;
  details?: unknown;
}

export function handleApplicationError(error: unknown, context: Context): Response {
  const { status, body } = toErrorResponse(error);

  if (status >= 500) {
    console.error("Unhandled application error", error);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
    },
  });
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

  return {
    status: 500,
    body: {
      error: "Internal server error.",
      code: "INTERNAL_SERVER_ERROR",
    },
  };
}
