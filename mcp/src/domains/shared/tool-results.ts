import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  BackendApiError,
  BackendUnavailableError,
} from "../../integrations/rentify-api/client.js";

type StructuredContent = Record<string, unknown>;
type ToolResult = CallToolResult;

function toToolErrorPayload(error: unknown) {
  if (error instanceof BackendApiError) {
    return {
      status: error.status,
      code: error.code,
      error: error.message,
      details: error.details,
    };
  }

  if (error instanceof BackendUnavailableError) {
    return {
      code: error.code,
      error: error.message,
      details: error.details,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    error: error instanceof Error ? error.message : "Unknown tool error.",
  };
}

export function toToolErrorResult(error: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(toToolErrorPayload(error), null, 2),
      },
    ],
    isError: true,
  };
}

export function toSuccessResult<TStructuredContent extends StructuredContent>(
  summary: string,
  structuredContent: TStructuredContent,
): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: summary,
      },
    ],
    structuredContent,
  };
}

export async function executeTool<TValue extends StructuredContent>(
  operation: () => Promise<TValue>,
  describe: (value: TValue) => string,
): Promise<ToolResult> {
  try {
    const result = await operation();
    return toSuccessResult(describe(result), result);
  } catch (error) {
    return toToolErrorResult(error);
  }
}
