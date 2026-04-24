import BadRequestError from "@/errors/http/bad-request.error";
import type { Context } from "hono";
import { ZodError, type ZodType, type output } from "zod";
import { assertSafeRequestBody } from "./input-sanitization";

export class RequestValidationError extends BadRequestError {
  constructor(
    message: string,
    public readonly details: Array<{
      path: string;
      message: string;
    }>,
  ) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export async function parseRequestBody<TSchema extends ZodType>(
  context: Context,
  schema: TSchema,
): Promise<output<TSchema>> {
  try {
    const body = await context.req.json();
    assertSafeRequestBody(context, body);
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new RequestValidationError(
        "Request body validation failed.",
        error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    if (error instanceof SyntaxError) {
      throw new RequestValidationError("Request body must be valid JSON.", []);
    }

    throw error;
  }
}
