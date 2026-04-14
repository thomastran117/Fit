import AppError from "@/errors/http/app.error";
import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { detectOutputFormat, serializeToXml } from "./output-format.middleware";

export interface ErrorResponseBody {
  error: string;
  code: string;
  details?: unknown;
}

export function handleApplicationError(error: unknown, context: Context<AppBindings>): Response {
  const { status, body } = toErrorResponse(error);
  const outputFormat = context.var.outputFormat ?? detectOutputFormat(context.req.raw);

  if (status >= 500) {
    console.error("Unhandled application error", error);
  }

  if (outputFormat === "xml") {
    return new Response(serializeToXml(body, "errorResponse"), {
      status,
      headers: {
        "content-type": "application/xml; charset=UTF-8",
      },
    });
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
