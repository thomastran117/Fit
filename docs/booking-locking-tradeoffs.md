# Booking Window Locking Tradeoffs

## Summary

This race-hardening pass uses a posting-wide Redis lock for overlap-sensitive booking, payment-success, renting-conversion, and owner availability-block mutations.

Lock key:

- `posting:{postingId}:booking-window`

This is intentionally a conservative first step. It gives us deterministic serialization for all overlapping booking-window writes on a posting without introducing multi-key locking complexity in the application layer.

## Why This Pass Uses A Posting-Wide Lock

The current cache service exposes ownership-safe single-key Redis locks. That is enough to make one posting-wide critical section safe and predictable:

- approval and decline races become deterministic
- payment success cannot create overlapping paid holds while conversion is running
- conversion cannot interleave with a second conversion or a conflicting owner availability-block write
- owner availability-block mutations no longer race approval, payment success, or conversion on the same posting

Date-window-specific keys were intentionally deferred in this pass because overlapping windows are not guaranteed to map to the same normalized key. Without a multi-lock strategy, two differently-shaped overlapping windows could still run concurrently and recreate the exact race we are trying to eliminate.

## Why Redis Locks Are Guardrails, Not The Only Boundary

Redis locking reduces the race window and gives clients clean `409 Conflict` responses when a request is already in flight, but correctness still has to hold at the database layer.

This implementation keeps the database as the final consistency boundary by also tightening repository writes:

- conditional `updateMany` predicates instead of id-only updates
- in-transaction rechecks before writes
- ownership-safe conversion reservation release
- Prisma unique-conflict mapping during renting conversion

If Redis is unavailable, delayed, or bypassed, these database predicates and constraints still protect final state.

## Current Tradeoff

The main downside of a posting-wide lock is contention:

- unrelated, non-overlapping windows on the same posting cannot finalize in parallel
- webhook reconciliation, conversion, and owner availability updates may queue behind one another more often than strictly necessary
- the approach prioritizes safety and predictable correctness over maximum throughput

That tradeoff is acceptable for this pass because the current goal is to remove stale-write races and prevent confusing state changes or preventable `5xx` errors.

## Known Gaps Deferred

These are intentionally not solved by the current posting-wide lock design:

- finer-grained concurrency for unrelated windows on the same posting
- ownership-safe multi-key or range-based lock acquisition
- automatic lock-extension logic for unusually slow critical sections
- broader serialization for flows that only validate against booking-window state but do not yet mutate under the posting lock

## Criteria For A Future Finer-Grained Design

We should only move beyond posting-wide serialization once the replacement can preserve the same safety guarantees:

- overlapping windows must always serialize, even when the requested ranges are shaped differently
- lock ownership and release must remain token-safe
- deadlock risk from multi-lock acquisition must be explicitly controlled
- failure behavior must stay client-safe, with `409 Conflict` instead of raw infrastructure or database errors
- repository predicates and database constraints must remain in place as the final correctness boundary

## Follow-Up

This document pairs with GitHub issue `#79`, "Expand booking-window locking beyond posting-wide serialization", to evaluate a stronger overlap-aware locking strategy once the current race-hardening pass is merged and observed in real usage.
