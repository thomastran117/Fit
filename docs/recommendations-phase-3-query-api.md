# Recommendations Phase 3: Query API

## Overview
Phase 3 exposes a backend endpoint that returns recommended postings with low latency by reading precomputed recommendation snapshots. This phase turns the earlier capture and worker phases into a consumable product surface.

## Goals
- Expose a dedicated recommendations endpoint for clients.
- Return personalized results for signed-in users when available.
- Return popular results for anonymous users and cold-start/fallback cases.
- Keep the request path limited to snapshot lookup, eligibility checks, lightweight filtering, and posting hydration.

## In Scope
- `GET /postings/recommendations`
- Optional authentication behavior.
- Runtime filtering over precomputed ranked candidates.
- Fallback from personalized to popular recommendations.
- Response metadata that explains which mode served the request.

## Out of Scope
- Building recommendations in request time.
- Frontend placement and presentation.
- Deep explainability tooling beyond lightweight reason codes.
- Advanced experimentation frameworks.

## API Direction
- Dedicated endpoint, not a search mode.
- Core filters for v1:
  - `page`
  - `pageSize`
  - `family`
  - `subtype`
  - `latitude`
  - `longitude`
  - `radiusKm`
  - `startAt`
  - `endAt`

## Request Behavior
- Signed-in user with a fresh personalized snapshot:
  - serve `mode: personalized`
- Anonymous user:
  - serve `mode: popular`
- Signed-in user with missing, stale, or insufficient profile data:
  - serve `mode: popular`
  - mark response as fallback

## Runtime Rules
- Only public postings are eligible.
- User's own postings are excluded.
- Existing renter-specific hard conflicts should be excluded.
- Availability-window filtering is applied at read time.
- Geo filtering is applied at read time.
- The API may scan deeper into the stored ranked pool if early candidates are filtered out.

## Response Direction
- Public posting records
- Pagination metadata
- Recommendation mode
- Fallback indicator
- Snapshot freshness timestamp
- Lightweight reason codes per posting

## Performance Intent
- No full ranking on the request path.
- No dependency on live aggregate computation during reads.
- Reads should primarily consist of snapshot lookup and posting hydration.

## Acceptance Criteria
- Endpoint returns popular recommendations for anonymous traffic.
- Endpoint returns personalized recommendations for qualified signed-in users.
- Fallback behavior is explicit and stable.
- Runtime filters work without needing to rebuild the snapshot on every request.
- Latency remains low because ranking is precomputed.

## Open Questions For Next Pass
- Should the API expose score details internally for testing/debugging?
- How should snapshot staleness thresholds be defined?
- How many deeper ranked candidates should the endpoint scan before returning fewer-than-requested results?
