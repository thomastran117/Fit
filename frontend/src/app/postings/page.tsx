import type { Metadata } from "next";
import Link from "next/link";
import { PostingSearchForm } from "@/components/postings/posting-search-form";
import {
  PublicPostingSearchError,
  searchPublicPostings,
  type PostingSort,
  type PublicPostingSearchParams,
  type PublicPostingSearchResult,
} from "@/lib/postings/search";

export const metadata: Metadata = {
  title: "Browse Postings | Rentify",
  description: "Search and browse published postings on Rentify.",
};

const sortOptions: Array<{ value: PostingSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "dailyPrice", label: "Lowest price" },
  { value: "nearest", label: "Nearest (requires location)" },
  { value: "nameAsc", label: "Name A–Z" },
  { value: "nameDesc", label: "Name Z–A" },
];

const pageSizeOptions = [10, 20, 50] as const;

const familyOptions = ["place", "equipment", "vehicle"] as const;

const subtypeOptions = [
  "entire_place",
  "private_room",
  "shared_room",
  "workspace",
  "storage_space",
  "tool",
  "camera",
  "audio",
  "event_equipment",
  "sports_outdoor",
  "general_equipment",
  "car",
  "truck_van",
  "bike",
  "motorcycle",
  "trailer",
  "general_vehicle",
] as const;

const availabilityStatusOptions = ["available", "limited", "unavailable"] as const;

interface PostingsPageProps {
  searchParams?: Promise<{
    q?: string | string[];
    sort?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    family?: string | string[];
    subtype?: string | string[];
    tags?: string | string[];
    availabilityStatus?: string | string[];
    minDailyPrice?: string | string[];
    maxDailyPrice?: string | string[];
    latitude?: string | string[];
    longitude?: string | string[];
    radiusKm?: string | string[];
    startAt?: string | string[];
    endAt?: string | string[];
  }>;
}

interface SearchDebugState {
  requestUrl: string;
  params: PublicPostingSearchParams;
  status?: number;
  statusText?: string;
  responseBody?: unknown;
  causeMessage?: string;
}

function readSingleParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isPostingSort(value: string | undefined): value is PostingSort {
  return sortOptions.some((option) => option.value === value);
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSearchHref(
  input: PublicPostingSearchParams & { page: number; pageSize: number; sort: PostingSort },
): string {
  const searchParams = new URLSearchParams();
  if (input.q) searchParams.set("q", input.q);
  searchParams.set("sort", input.sort);
  searchParams.set("page", String(input.page));
  searchParams.set("pageSize", String(input.pageSize));
  if (input.family) searchParams.set("family", input.family);
  if (input.subtype) searchParams.set("subtype", input.subtype);
  if (input.tags && input.tags.length > 0) searchParams.set("tags", input.tags.join(","));
  if (input.availabilityStatus) searchParams.set("availabilityStatus", input.availabilityStatus);
  if (input.minDailyPrice !== undefined) searchParams.set("minDailyPrice", String(input.minDailyPrice));
  if (input.maxDailyPrice !== undefined) searchParams.set("maxDailyPrice", String(input.maxDailyPrice));
  if (input.latitude !== undefined) searchParams.set("latitude", String(input.latitude));
  if (input.longitude !== undefined) searchParams.set("longitude", String(input.longitude));
  if (input.radiusKm !== undefined) searchParams.set("radiusKm", String(input.radiusKm));
  if (input.startAt) searchParams.set("startAt", input.startAt);
  if (input.endAt) searchParams.set("endAt", input.endAt);
  return `/postings?${searchParams.toString()}`;
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPublishedDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function resolveErrorDetails(
  message: string,
  debug: SearchDebugState | null,
): { title: string; description: string } {
  const isNetworkFailure = debug?.causeMessage?.toLowerCase().includes("fetch failed");
  if (isNetworkFailure) {
    return {
      title: "Could not reach the search server",
      description:
        "The API server is unreachable. Check that the backend is running and that INTERNAL_API_BASE_URL is configured correctly.",
    };
  }
  if (debug?.status === 400) {
    return {
      title: "Invalid search request",
      description:
        "One or more filter values were rejected by the server. Review your filters and try again.",
    };
  }
  if (debug?.status !== undefined && debug.status >= 500) {
    return {
      title: "Search server error",
      description: `The server returned ${debug.status} ${debug.statusText ?? ""}. This is likely temporary — try again in a moment.`.trim(),
    };
  }
  if (debug?.status !== undefined) {
    return {
      title: `Unexpected response (${debug.status})`,
      description: message,
    };
  }
  return {
    title: "Unable to load postings",
    description: message,
  };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}

function FilterPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ActiveFilters({
  q,
  family,
  subtype,
  tags,
  availabilityStatus,
  minDailyPrice,
  maxDailyPrice,
  latitude,
  longitude,
  radiusKm,
  startAt,
  endAt,
}: {
  q: string;
  family?: string;
  subtype?: string;
  tags?: string[];
  availabilityStatus?: string;
  minDailyPrice?: number;
  maxDailyPrice?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  startAt?: string;
  endAt?: string;
}) {
  const filters: string[] = [];

  if (q) filters.push(`Search: ${q}`);
  if (family) filters.push(humanize(family));
  if (subtype) filters.push(humanize(subtype));
  if (availabilityStatus) filters.push(humanize(availabilityStatus));
  if (minDailyPrice !== undefined || maxDailyPrice !== undefined) {
    filters.push(
      `Price: ${minDailyPrice ?? 0} - ${maxDailyPrice !== undefined ? maxDailyPrice : "Any"}`,
    );
  }
  if (tags && tags.length > 0) filters.push(`Tags: ${tags.join(", ")}`);
  if (latitude !== undefined && longitude !== undefined) {
    filters.push(`Near ${latitude}, ${longitude}${radiusKm ? ` within ${radiusKm} km` : ""}`);
  }
  if (startAt || endAt) filters.push("Date window");

  if (filters.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        No filters applied. Try searching broadly, then refine the results.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {filters.length} active
      </span>

      {filters.map((filter) => (
        <span
          key={filter}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
        >
          {filter}
        </span>
      ))}

      <Link
        href="/postings"
        className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-950"
      >
        Clear
      </Link>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default async function PostingsPage({ searchParams }: PostingsPageProps) {
  const resolvedSearchParams = await searchParams;
  const q = readSingleParam(resolvedSearchParams?.q)?.trim() || "";
  const sortValue = readSingleParam(resolvedSearchParams?.sort);
  const sort = isPostingSort(sortValue) ? sortValue : "relevance";
  const page = readPositiveNumber(readSingleParam(resolvedSearchParams?.page), 1);
  const requestedPageSize = readPositiveNumber(readSingleParam(resolvedSearchParams?.pageSize), 20);
  const pageSize = pageSizeOptions.includes(requestedPageSize as (typeof pageSizeOptions)[number])
    ? requestedPageSize
    : 20;

  const familyRaw = readSingleParam(resolvedSearchParams?.family);
  const family = familyOptions.includes(familyRaw as (typeof familyOptions)[number])
    ? (familyRaw as (typeof familyOptions)[number])
    : undefined;

  const subtypeRaw = readSingleParam(resolvedSearchParams?.subtype);
  const subtype = subtypeOptions.includes(subtypeRaw as (typeof subtypeOptions)[number])
    ? (subtypeRaw as (typeof subtypeOptions)[number])
    : undefined;

  const tagsRaw = readSingleParam(resolvedSearchParams?.tags);
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const availabilityStatusRaw = readSingleParam(resolvedSearchParams?.availabilityStatus);
  const availabilityStatus = availabilityStatusOptions.includes(
    availabilityStatusRaw as (typeof availabilityStatusOptions)[number],
  )
    ? (availabilityStatusRaw as (typeof availabilityStatusOptions)[number])
    : undefined;

  const minDailyPrice = parseOptionalNumber(readSingleParam(resolvedSearchParams?.minDailyPrice));
  const maxDailyPrice = parseOptionalNumber(readSingleParam(resolvedSearchParams?.maxDailyPrice));
  const latitude = parseOptionalNumber(readSingleParam(resolvedSearchParams?.latitude));
  const longitude = parseOptionalNumber(readSingleParam(resolvedSearchParams?.longitude));
  const radiusKm = parseOptionalNumber(readSingleParam(resolvedSearchParams?.radiusKm));

  const startAt = readSingleParam(resolvedSearchParams?.startAt) || undefined;
  const endAt = readSingleParam(resolvedSearchParams?.endAt) || undefined;

  let result: PublicPostingSearchResult | null = null;
  let errorMessage: string | null = null;
  let debugState: SearchDebugState | null = null;

  try {
    result = await searchPublicPostings({
      q: q || undefined,
      sort,
      page,
      pageSize,
      family,
      subtype,
      tags: tags && tags.length > 0 ? tags : undefined,
      availabilityStatus,
      minDailyPrice,
      maxDailyPrice,
      latitude,
      longitude,
      radiusKm,
      startAt,
      endAt,
    });
  } catch (error) {
    if (error instanceof PublicPostingSearchError) {
      errorMessage = error.message;
      debugState = error.debug;
    } else {
      errorMessage = error instanceof Error ? error.message : "Unable to load postings right now.";
    }
  }

  const paginationProps = {
    q: q || undefined,
    sort,
    pageSize,
    family,
    subtype,
    tags: tags && tags.length > 0 ? tags : undefined,
    availabilityStatus,
    minDailyPrice,
    maxDailyPrice,
    latitude,
    longitude,
    radiusKm,
    startAt,
    endAt,
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Search form */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-500">Rentify marketplace</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Find what you need to rent
            </h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Search by item, place, description, or tag. Start broad, then narrow results with filters.
            </p>
          </div>

          <PostingSearchForm
            className="mt-6 flex flex-col gap-5"
            initialStartAt={startAt}
            initialEndAt={endAt}
          >
            <input type="hidden" name="page" value="1" />

            {/* Primary search */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <label htmlFor="q" className="sr-only">
                    Search postings
                  </label>
                  <input
                    id="q"
                    type="search"
                    name="q"
                    defaultValue={q}
                    placeholder="Search cameras, private rooms, bikes, tools..."
                    className="h-12 w-full rounded-xl border border-transparent bg-slate-50 px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  className="h-12 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Search
                </button>
              </div>

              {/* Category chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                <FilterChip
                  href={buildSearchHref({
                    ...paginationProps,
                    family: undefined,
                    subtype: undefined,
                    page: 1,
                    pageSize,
                    sort,
                  })}
                  active={!family}
                >
                  All
                </FilterChip>

                {familyOptions.map((option) => (
                  <FilterChip
                    key={option}
                    href={buildSearchHref({
                      ...paginationProps,
                      family: option,
                      subtype: undefined,
                      page: 1,
                      pageSize,
                      sort,
                    })}
                    active={family === option}
                  >
                    {humanize(option)}
                  </FilterChip>
                ))}
              </div>
            </div>

            {/* Active filters */}
            <ActiveFilters
              q={q}
              family={family}
              subtype={subtype}
              tags={tags}
              availabilityStatus={availabilityStatus}
              minDailyPrice={minDailyPrice}
              maxDailyPrice={maxDailyPrice}
              latitude={latitude}
              longitude={longitude}
              radiusKm={radiusKm}
              startAt={startAt}
              endAt={endAt}
            />

            {/* Main refinement row */}
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Sort results" htmlFor="sort" hint="Choose how results are ranked.">
                <select id="sort" name="sort" defaultValue={sort} className={inputClass}>
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Availability" htmlFor="availabilityStatus" hint="Hide unavailable listings.">
                <select
                  id="availabilityStatus"
                  name="availabilityStatus"
                  defaultValue={availabilityStatus ?? ""}
                  className={inputClass}
                >
                  <option value="">Any availability</option>
                  {availabilityStatusOptions.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Results per page" htmlFor="pageSize" hint="Controls how many listings appear.">
                <select id="pageSize" name="pageSize" defaultValue={String(pageSize)} className={inputClass}>
                  {pageSizeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n} results
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Advanced filters */}
            <details className="group rounded-2xl border border-slate-200 bg-slate-50/70">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Advanced filters</p>
                  <p className="text-xs text-slate-500">
                    Price, subtype, tags, distance, and availability dates.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 group-open:hidden">
                  Show
                </span>
                <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 group-open:inline">
                  Hide
                </span>
              </summary>

              <div className="border-t border-slate-200 p-4">
                <div className="grid gap-5 lg:grid-cols-2">
                  {/* What */}
                  <FilterPanel
                    title="What are you renting?"
                    description="Use subtype and tags when the search text is not specific enough."
                  >
                    <Field label="Subtype" htmlFor="subtype">
                      <select id="subtype" name="subtype" defaultValue={subtype ?? ""} className={inputClass}>
                        <option value="">Any subtype</option>
                        {subtypeOptions.map((s) => (
                          <option key={s} value={s}>
                            {humanize(s)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Tags" htmlFor="tags" hint="Separate tags with commas, like wifi, pet-friendly.">
                      <input
                        id="tags"
                        type="text"
                        name="tags"
                        defaultValue={tags ? tags.join(", ") : ""}
                        placeholder="wifi, pet-friendly, tripod"
                        className={inputClass}
                      />
                    </Field>
                  </FilterPanel>

                  {/* Price */}
                  <FilterPanel
                    title="Budget"
                    description="Set a daily price range to avoid listings outside your budget."
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Min daily price" htmlFor="minDailyPrice">
                        <input
                          id="minDailyPrice"
                          type="number"
                          name="minDailyPrice"
                          defaultValue={minDailyPrice ?? ""}
                          placeholder="$0"
                          min={0}
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Max daily price" htmlFor="maxDailyPrice">
                        <input
                          id="maxDailyPrice"
                          type="number"
                          name="maxDailyPrice"
                          defaultValue={maxDailyPrice ?? ""}
                          placeholder="No limit"
                          min={0}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </FilterPanel>

                  {/* Location */}
                  <FilterPanel
                    title="Nearby search"
                    description="Use coordinates only when the user wants results near a specific area."
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Latitude" htmlFor="latitude">
                        <input
                          id="latitude"
                          type="number"
                          name="latitude"
                          defaultValue={latitude ?? ""}
                          placeholder="43.6532"
                          step="any"
                          min={-90}
                          max={90}
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Longitude" htmlFor="longitude">
                        <input
                          id="longitude"
                          type="number"
                          name="longitude"
                          defaultValue={longitude ?? ""}
                          placeholder="-79.3832"
                          step="any"
                          min={-180}
                          max={180}
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Radius" htmlFor="radiusKm">
                        <input
                          id="radiusKm"
                          type="number"
                          name="radiusKm"
                          defaultValue={radiusKm ?? ""}
                          placeholder="25 km"
                          min={0}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </FilterPanel>

                  {/* Dates */}
                  <FilterPanel
                    title="Availability dates"
                    description="Filter to listings available during the renter’s preferred window."
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Start date" htmlFor="startAt">
                        <input
                          id="startAt"
                          type="datetime-local"
                          name="startAt"
                          defaultValue=""
                          className={inputClass}
                        />
                      </Field>

                      <Field label="End date" htmlFor="endAt">
                        <input
                          id="endAt"
                          type="datetime-local"
                          name="endAt"
                          defaultValue=""
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </FilterPanel>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <Link
                    href="/postings"
                    className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
                  >
                    Reset all filters
                  </Link>

                  <button
                    type="submit"
                    className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Apply filters
                  </button>
                </div>
              </div>
            </details>
          </PostingSearchForm>
        </div>
      </section>

      {/* Results */}
      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {errorMessage ? (
          <SearchError message={errorMessage} debug={debugState} />
        ) : result ? (
          <SearchResults
            result={result}
            pageSize={pageSize}
            paginationProps={paginationProps}
          />
        ) : null}
      </section>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SearchError({
  message,
  debug,
}: {
  message: string;
  debug: SearchDebugState | null;
}) {
  const { title, description } = resolveErrorDetails(message, debug);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <p className="font-semibold text-rose-900">{title}</p>
        <p className="mt-1 text-sm text-rose-700">{description}</p>
      </div>

      {debug ? (
        <details className="rounded-2xl border border-slate-200 text-sm">
          <summary className="cursor-pointer select-none px-4 py-3 font-medium text-slate-700 hover:bg-slate-50">
            Debug details
          </summary>
          <dl className="grid gap-3 border-t border-slate-200 px-4 py-3 text-slate-700">
            <div>
              <dt className="font-medium text-slate-950">Request URL</dt>
              <dd className="mt-0.5 break-all text-slate-600">{debug.requestUrl}</dd>
            </div>
            {debug.status ? (
              <div>
                <dt className="font-medium text-slate-950">HTTP status</dt>
                <dd className="mt-0.5 text-slate-600">
                  {debug.status} {debug.statusText}
                </dd>
              </div>
            ) : null}
            {debug.causeMessage ? (
              <div>
                <dt className="font-medium text-slate-950">Fetch error</dt>
                <dd className="mt-0.5 text-slate-600">{debug.causeMessage}</dd>
              </div>
            ) : null}
            {debug.responseBody !== undefined ? (
              <div>
                <dt className="font-medium text-slate-950">Response body</dt>
                <dd className="mt-0.5">
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">
                    {JSON.stringify(debug.responseBody, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-slate-950">Params sent</dt>
              <dd className="mt-0.5">
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">
                  {JSON.stringify(debug.params, null, 2)}
                </pre>
              </dd>
            </div>
          </dl>
        </details>
      ) : null}
    </div>
  );
}

function SearchResults({
  result,
  pageSize,
  paginationProps,
}: {
  result: PublicPostingSearchResult;
  pageSize: number;
  paginationProps: Omit<Parameters<typeof buildSearchHref>[0], "page">;
}) {
  const { pagination, postings } = result;
  const rangeStart = (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        {pagination.total === 0 ? (
          <span>No results</span>
        ) : (
          <span>
            Showing {rangeStart}–{rangeEnd} of {pagination.total}{" "}
            {pagination.total === 1 ? "posting" : "postings"}
          </span>
        )}
        <span className="text-xs text-slate-400">
          via {result.source} · page {pagination.page} of {pagination.totalPages || 1}
        </span>
      </div>

      {postings.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No postings matched your search. Try broadening your filters.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {postings.map((posting) => {
            const publishedDate = formatPublishedDate(posting.publishedAt);
            const previewImageUrl = posting.primaryThumbnailUrl ?? posting.primaryPhotoUrl;

            return (
              <article
                key={posting.id}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="relative min-h-44 border-b border-slate-200 bg-slate-100 md:min-h-full md:border-b-0 md:border-r">
                    {previewImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImageUrl}
                        alt={posting.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-950">{posting.name}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {humanize(posting.variant.family)} · {humanize(posting.variant.subtype)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AvailabilityBadge status={posting.availabilityStatus} />
                    <span className="font-semibold text-slate-950">
                      {formatPrice(posting.pricing.daily.amount, posting.pricing.currency)}
                      <span className="text-xs font-normal text-slate-500"> / day</span>
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{posting.description}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    {posting.location.city}, {posting.location.region},{" "}
                    {posting.location.country}
                  </span>
                  {publishedDate ? <span>Published {publishedDate}</span> : null}
                  <span className="text-slate-300">ID: {posting.id}</span>
                </div>

                {posting.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {posting.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        {pagination.hasPreviousPage ? (
          <Link
            href={buildSearchHref({ ...paginationProps, page: pagination.page - 1, pageSize })}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ← Previous
          </Link>
        ) : (
          <span className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-300">
            ← Previous
          </span>
        )}

        {pagination.hasNextPage ? (
          <Link
            href={buildSearchHref({ ...paginationProps, page: pagination.page + 1, pageSize })}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-300">
            Next →
          </span>
        )}
      </div>
    </>
  );
}

function AvailabilityBadge({ status }: { status: "available" | "limited" | "unavailable" }) {
  const styles = {
    available: "bg-emerald-50 text-emerald-700 border-emerald-200",
    limited: "bg-amber-50 text-amber-700 border-amber-200",
    unavailable: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const labels = {
    available: "Available",
    limited: "Limited",
    unavailable: "Unavailable",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
