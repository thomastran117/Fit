import { getDeviceId, getDevicePlatform } from "@/lib/auth/device";
import { readStoredSession } from "@/lib/auth/storage";
import { ApiError, type ApiErrorResponse } from "@/lib/auth/types";
import { publicEnv } from "@/lib/env";

export interface BookingQuoteInput {
  startAt: string;
  endAt: string;
  guestCount: number;
  note?: string | null;
}

export interface BookingQuoteFailureReason {
  code:
    | "own_posting"
    | "posting_unavailable"
    | "invalid_dates"
    | "max_duration_exceeded"
    | "invalid_guest_count"
    | "guest_count_exceeded"
    | "note_too_long"
    | "renting_overlap"
    | "availability_block_overlap"
    | "active_request_limit_exceeded";
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface BookingQuoteResult {
  postingId: string;
  bookable: boolean;
  durationDays: number | null;
  pricingCurrency: string;
  dailyPriceAmount: number;
  estimatedTotal: number | null;
  maxBookingDurationDays: number;
  failureReasons: BookingQuoteFailureReason[];
}

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function readCsrfToken(): string | undefined {
  const token = readCookie(CSRF_COOKIE_NAME);
  return token ? decodeURIComponent(token) : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

async function postAuthenticatedJson<TResponse, TBody extends object>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const deviceId = getDeviceId();
  const devicePlatform = getDevicePlatform();
  const session = readStoredSession();
  const csrfToken = readCsrfToken();
  const response = await fetch(`${publicEnv.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
      ...(deviceId ? { "x-device-id": deviceId } : {}),
      ...(devicePlatform ? { "x-device-platform": devicePlatform } : {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as Partial<ApiErrorResponse>;
    throw new ApiError(
      errorPayload.error ?? "Something went wrong.",
      errorPayload.code ?? "UNKNOWN_ERROR",
      response.status,
      errorPayload.details,
    );
  }

  return payload as TResponse;
}

export const postingsApi = {
  quoteBooking(postingId: string, input: BookingQuoteInput): Promise<BookingQuoteResult> {
    return postAuthenticatedJson<BookingQuoteResult, BookingQuoteInput>(
      `/postings/${encodeURIComponent(postingId)}/booking-quote`,
      input,
    );
  },
};
