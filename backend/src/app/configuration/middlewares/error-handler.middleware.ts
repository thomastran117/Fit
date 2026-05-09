import AppError from "@/errors/http/app.error";
import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import {
  buildErrorResponse,
  type ApiErrorItem,
  type ApiErrorResponse,
} from "@/configuration/http/responses";
import { loggerFactory } from "@/configuration/logging";
import { RequestValidationError } from "@/configuration/validation/request";
import { detectOutputFormat, serializeToXml } from "./output-format.middleware";

const errorLogger = loggerFactory.forComponent("error-handler.middleware", "middleware");

export function handleApplicationError(error: unknown, context: Context<AppBindings>): Response {
  const { status, body } = toErrorResponse(error);
  const responseBody = buildErrorResponse(context, body);
  const outputFormat = context.var.outputFormat ?? detectOutputFormat(context.req.raw);
  const headers = new Headers(context.res?.headers);

  if (status >= 500) {
    const requestLogger = context.get("logger");
    (requestLogger ?? errorLogger).error("Unhandled application error.", undefined, error);
  }

  if (outputFormat === "xml") {
    headers.set("content-type", "application/xml; charset=UTF-8");

    return new Response(serializeToXml(responseBody, "errorResponse"), {
      status,
      headers,
    });
  }

  headers.set("content-type", "application/json; charset=UTF-8");

  return new Response(JSON.stringify(responseBody), {
    status,
    headers,
  });
}

export function toErrorResponse(error: unknown): {
  status: number;
  body: Omit<ApiErrorResponse, "meta">;
} {
  if (error instanceof RequestValidationError) {
    return {
      status: error.status,
      body: {
        message: error.message,
        errors: error.details.map((issue) => ({
          code: "VALIDATION_ERROR",
          field: issue.path,
          message: issue.message,
        })),
      },
    };
  }

  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        message: error.message,
        errors: toAppErrorItems(error),
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  return {
    status: 500,
    body: {
      message: "Internal server error.",
      errors: [
        {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error.",
        },
      ],
    },
  };
}

function toAppErrorItems(error: AppError): ApiErrorItem[] | undefined {
  if (error.code === "BAD_REQUEST" && Array.isArray(error.details)) {
    return undefined;
  }

  return [
    {
      code: error.code,
      message: error.message,
    },
  ];
}
