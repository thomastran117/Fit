import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";

export interface ApiResponseMeta {
  requestId: string;
  pagination?: unknown;
  [key: string]: unknown;
}

export interface ApiSuccessResponse<TData> {
  data: TData;
  meta: ApiResponseMeta;
  message?: string;
  details?: unknown;
}

export interface ApiErrorItem {
  code?: string;
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  message: string;
  meta: ApiResponseMeta;
  errors?: ApiErrorItem[];
  details?: unknown;
}

interface ResponseOptions {
  message?: string;
  details?: unknown;
  meta?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRequestId(context: Context<AppBindings>): string {
  const requestId = context.get("requestId");
  return typeof requestId === "string" && requestId.length > 0 ? requestId : "unknown";
}

export function mergeResponseMeta(
  ...sources: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const merged = Object.assign({}, ...sources.filter((source) => source !== undefined));
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function paginationMeta(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value) || !("pagination" in value)) {
    return undefined;
  }

  return {
    pagination: value.pagination,
  };
}

export function pickMeta<TKeys extends string>(
  value: unknown,
  keys: readonly TKeys[],
): Partial<Record<TKeys, unknown>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const meta: Partial<Record<TKeys, unknown>> = {};

  for (const key of keys) {
    if (key in value) {
      meta[key] = value[key];
    }
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

export function buildResponseMeta(
  context: Context<AppBindings>,
  meta?: Record<string, unknown>,
): ApiResponseMeta {
  return {
    requestId: resolveRequestId(context),
    ...(meta ?? {}),
  };
}

export function buildSuccessResponse<TData>(
  context: Context<AppBindings>,
  data: TData,
  options: ResponseOptions = {},
): ApiSuccessResponse<TData> {
  return {
    ...(options.message !== undefined ? { message: options.message } : {}),
    ...(options.details !== undefined ? { details: options.details } : {}),
    data,
    meta: buildResponseMeta(context, options.meta),
  };
}

export function buildErrorResponse(
  context: Context<AppBindings>,
  input: {
    message: string;
    errors?: ApiErrorItem[];
    details?: unknown;
    meta?: Record<string, unknown>;
  },
): ApiErrorResponse {
  return {
    message: input.message,
    meta: buildResponseMeta(context, input.meta),
    ...(input.errors && input.errors.length > 0 ? { errors: input.errors } : {}),
    ...(input.details !== undefined ? { details: input.details } : {}),
  };
}

function jsonResponse<TData>(
  context: Context<AppBindings>,
  status: 200 | 201 | 202,
  data: TData,
  options?: ResponseOptions,
): Response {
  return context.json(buildSuccessResponse(context, data, options), status);
}

export function ok<TData>(
  context: Context<AppBindings>,
  data: TData,
  options?: ResponseOptions,
): Response {
  return jsonResponse(context, 200, data, options);
}

export function created<TData>(
  context: Context<AppBindings>,
  data: TData,
  options?: ResponseOptions,
): Response {
  return jsonResponse(context, 201, data, options);
}

export function accepted<TData>(
  context: Context<AppBindings>,
  data: TData,
  options?: ResponseOptions,
): Response {
  return jsonResponse(context, 202, data, options);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}
