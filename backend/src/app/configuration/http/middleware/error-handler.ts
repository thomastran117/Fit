import type { Context } from "hono";
import { toErrorResponse } from "@/configuration/http/errors";

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
