# Recommendations Phase 2: Precompute Worker

## Overview
Phase 2 builds recommendations asynchronously and stores precomputed results. The goal is to keep recommendation requests fast and predictable by moving ranking work off the request path.

## Goals
- Build personalized recommendation snapshots for signed-in users.
- Build popular recommendation snapshots for anonymous and fallback use cases.
- Store ranked candidates ahead of time so the API only performs lightweight filtering and hydration.

## In Scope
- A worker that consumes recommendation refresh jobs.
- Precomputed per-user recommendation snapshots.
- Precomputed popular recommendation snapshots.
- A lightweight user preference/profile representation used by the worker.
- Rebuild and freshness policies for personalized and popular data.

## Out of Scope
- Request-time recommendation ranking.
- Full ML or model-based ranking systems.
- Precomputing every possible filter combination.
- Frontend delivery.

## Inputs
- Authenticated posting views.
- Booking requests created by renters.
- Confirmed rentings.
- Posting metadata such as family, subtype, tags, searchable attributes, pricing, and location.
- Marketplace popularity metrics such as views, booking requests, and confirmed rentings.

## Planned Storage
- `RecommendationRefreshJob`
- `UserRecommendationProfile`
- `UserRecommendationSnapshot`
- `PopularRecommendationSnapshot`

## Worker Responsibilities
- Claim refresh jobs in batches.
- Rebuild one user's personalized recommendation set when user activity changes.
- Rebuild popular recommendation sets when marketplace activity or posting eligibility changes.
- Keep only the top ranked candidate set per snapshot to support fast reads.

## Ranking Direction
- Personalized snapshots should combine user affinity, popularity, freshness, and eligibility-aware biases.
- Popular snapshots should combine views, booking activity, renting activity, and recency decay.
- Previously viewed postings should be de-prioritized, not hidden.

## Freshness Strategy
- Personalized snapshots rebuild on user-driven events.
- Popular snapshots rebuild on marketplace activity and periodic staleness sweeps.
- Missing or stale personalized data should be allowed to fall back to popular data later in the API layer.

## Outputs
- Ranked per-user recommendation candidates.
- Ranked popular candidates by segment.
- Configurable scoring weights and thresholds.

## Acceptance Criteria
- Worker can rebuild personalized recommendations for a user without blocking request traffic.
- Worker can rebuild popular recommendations independently of user-specific jobs.
- Snapshots are queryable by rank and freshness timestamp.
- Stale or missing user data can safely fall back to popular recommendations.

## Open Questions For Next Pass
- What exact ranking weights should v1 use?
- Which popular segments are worth storing in v1: global only, family, or family plus subtype?
- How large should each stored candidate pool be to support runtime filtering without waste?
