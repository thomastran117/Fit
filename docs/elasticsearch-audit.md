# Elasticsearch Search Audit

## Scope

This note summarizes an audit of the Elasticsearch-backed postings search flow, including:

- Search request construction
- Elasticsearch client behavior
- Database fallback behavior
- Outbox, queue, and reindex workflows
- Operational visibility and test coverage

No implementation changes are included in this document.

## Current Architecture

The search flow is split across a few main parts:

- `PostingsSearchService` builds Elasticsearch queries, writes documents, manages aliases, and falls back to the database when Elasticsearch is unavailable.
- `ElasticsearchClient` wraps HTTP calls and applies a simple circuit breaker.
- `PostingsRepository.searchPublicFallback()` provides degraded-mode database search.
- Search indexing is asynchronous through a posting search outbox, RabbitMQ relay, indexing worker, and reindex worker.
- Reindexing uses versioned indices and read/write aliases.

## Findings

### 1. Reindex startup is vulnerable to concurrent runs

`SearchService.startReindex()` checks for an active run and then creates a new run, but there is no transactional guard or database uniqueness constraint enforcing that only one active reindex can exist at a time.

Potential impact:

- Two admins can start overlapping reindex runs.
- Multiple target indices may be created unnecessarily.
- Alias swaps and catch-up processing become harder to reason about operationally.

Suggested improvement:

- Add a stronger concurrency guard at the database level or use a transactional locking strategy around reindex creation.

### 2. Alias bootstrap can redirect search to a fresh empty index

`ensureLiveIndex()` creates a new concrete index and resets aliases whenever either the read alias or write alias is missing.

Potential impact:

- A partial alias misconfiguration can cause production reads to point at an empty index.
- A recoverable alias drift event becomes a user-visible search outage.

Suggested improvement:

- Treat missing read/write aliases differently.
- Repair missing aliases conservatively instead of immediately creating and promoting a new empty index.
- Add safeguards before moving the read alias.

### 3. Stale Elasticsearch hits can produce thin pages and misleading totals

The public search path gets ordered IDs and totals from Elasticsearch, then fetches records from the database. If Elasticsearch returns stale IDs that no longer map to public postings, those records are dropped silently.

Potential impact:

- Returned pages may contain fewer items than `pageSize`.
- Pagination totals can diverge from what the user actually sees.
- Search can feel inconsistent when indexing lags behind source-of-truth changes.

Suggested improvement:

- Detect and measure stale-hit drop rate.
- Consider topping up pages when stale IDs are filtered out.
- Define clearer behavior for pagination when Elasticsearch and the database drift temporarily.

### 4. Circuit breaker treats all request failures as availability failures

The Elasticsearch client increments circuit-breaker failures for any non-success response, including 4xx responses that may indicate invalid queries, mapping issues, or bad documents rather than cluster unavailability.

Potential impact:

- Data or query bugs can open the circuit.
- Production traffic may fall back to the database even when Elasticsearch itself is healthy.
- Root causes can be obscured because application-level faults look like infrastructure outages.

Suggested improvement:

- Separate transport or timeout failures from request-validation or mapping failures.
- Only count true availability failures toward opening the circuit.

### 5. Queue health reporting can mask broker issues

Admin search status falls back to zeroed queue counts when broker checks fail.

Potential impact:

- The status endpoint can look healthy enough during RabbitMQ outages.
- Operators may miss that indexing is stalled.

Suggested improvement:

- Surface queue-inspection errors explicitly in status output.
- Distinguish between "empty queue" and "unable to inspect queue".

## Product and Relevance Improvements

These are not necessarily defects, but they are strong opportunities to improve the search experience.

### 1. Searchable attributes are indexed but not queryable

Variant-specific searchable attributes are normalized and indexed into Elasticsearch documents, but the public search API does not expose filters for them.

Opportunity:

- Add structured filtering on indexed attributes such as bedrooms, amenities, make, model, year, and similar fields.

### 2. Text relevance is still baseline quality

The current query combines `multi_match`, fuzzy matching, and a boosted `match_phrase` on the name field. This is a reasonable starting point, but it is still a fairly simple ranking strategy.

Opportunity:

- Introduce better analyzers and field-specific ranking behavior.
- Add synonym handling where appropriate.
- Consider prefix or autocomplete support for marketplace discovery.
- Tune exact-match boosts separately from fuzzy matching.

### 3. Database fallback is intentionally approximate, not equivalent

The fallback query uses SQL `LIKE`, JSON extraction, and handcrafted relevance ordering. That is acceptable for degraded mode, but it will not behave the same as Elasticsearch.

Opportunity:

- Decide whether degraded search should aim for closer parity or remain a best-effort backup mode.
- If fallback is expected to be used in production, define and test the expected differences explicitly.

### 4. Deep pagination may not scale well

Elasticsearch requests use `from` and `size`, which become less efficient at larger offsets.

Opportunity:

- If the product will need large result-set navigation, move toward `search_after` and point-in-time reads.

## Operational Improvements

Recommended observability additions:

- Elasticsearch request latency and error rate
- Circuit breaker open rate
- Percentage of searches served from database fallback
- Outbox backlog size and age
- Dead-letter queue depth
- Reindex duration and completion rate
- Alias target age and last successful swap time
- Rate of stale Elasticsearch IDs dropped during database hydration

## Testing Gaps

The current tests cover query construction and basic fallback behavior reasonably well, but the riskiest lifecycle paths appear under-tested.

Missing or light areas:

- Concurrent reindex start attempts
- Alias repair and bootstrap edge cases
- Safe behavior when one alias exists and the other does not
- Page reconciliation when Elasticsearch returns stale IDs
- Reindex catch-up and alias swap lifecycle behavior
- Status endpoint behavior during broker failure

## Suggested Next Steps

Recommended order of follow-up:

1. Harden reindex concurrency and alias safety.
2. Improve observability for fallback, queue health, and index drift.
3. Decide whether stale-hit reconciliation is required for user-facing pagination quality.
4. Expand the search API to support structured attribute filters.
5. Revisit relevance tuning once correctness and operations are more robust.
