import AppError from "@/errors/http/app.error";
import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { loggerFactory } from "@/configuration/logging";
import { detectOutputFormat, serializeToXml } from "./output-format.middleware";

export interface ErrorResponseBody {
  error: string;
  code: string;
  details?: unknown;
}

const errorLogger = loggerFactory.forComponent("error-handler.middleware", "middleware");

export function handleApplicationError(error: unknown, context: Context<AppBindings>): Response {
  const { status, body } = toErrorResponse(error);
  const outputFormat = context.var.outputFormat ?? detectOutputFormat(context.req.raw);
  const headers = new Headers(context.res?.headers);

  if (status >= 500) {
    const requestLogger = context.get("logger");
    (requestLogger ?? errorLogger).error("Unhandled application error.", undefined, error);
  }

  if (outputFormat === "xml") {
    headers.set("content-type", "application/xml; charset=UTF-8");

    return new Response(serializeToXml(body, "errorResponse"), {
      status,
      headers,
    });
  }

  headers.set("content-type", "application/json; charset=UTF-8");

  return new Response(JSON.stringify(body), {
    status,
    headers,
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
