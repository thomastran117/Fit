# Recommendations Phase 1: Activity Capture

## Overview
Phase 1 establishes the input signals that power recommendations. The goal is to reliably capture renter behavior and marketplace intent so later phases can compute personalized and popular recommendation feeds without depending on expensive request-time inference.

## Goals
- Capture authenticated user activity relevant to recommendations.
- Reuse existing marketplace events where possible instead of duplicating source data.
- Enqueue asynchronous refresh work whenever user activity meaningfully changes recommendation relevance.

## In Scope
- Treat posting detail views as recommendation signals for signed-in users.
- Reuse booking request and confirmed renting activity as strong recommendation signals.
- Add a recommendation refresh job mechanism so activity does not trigger synchronous recomputation.
- Define the source-of-truth activity inputs for later recommendation building.

## Out of Scope
- Final recommendation ranking formulas.
- Serving recommendation results to clients.
- Frontend recommendation UI.
- Secondary signals such as favorites, saved searches, dwell time, or messaging.

## Existing Foundations
- `PostingViewEvent` already stores posting views and can include `userId` for authenticated viewers.
- Booking requests already exist and represent renter intent.
- Confirmed rentings already exist and represent the strongest renter preference signal.
- Posting analytics outbox patterns already exist and provide a good model for async event handling.

## Planned Additions
- A dedicated recommendation refresh queue/table.
- Trigger points that enqueue `user_refresh` and `popular_refresh` jobs.
- Clear event rules for which actions should refresh personalized recommendations and which should refresh popular recommendations.

## Key Decisions
- Only signed-in views contribute to personalized recommendations.
- Anonymous traffic contributes to popularity, not to user-specific profiles.
- Existing domain tables remain the system of record for activity; the new queue exists to trigger downstream rebuilds.

## Outputs
- Defined recommendation input signals.
- Recommendation refresh job model and lifecycle.
- Clear enqueue points in viewing, booking, renting, and posting lifecycle flows.

## Acceptance Criteria
- Signed-in posting views can be linked to a user.
- Booking and renting activity can trigger recommendation refresh work.
- Refresh jobs are deduplicated enough to avoid event flooding.
- The system can identify when to rebuild one user versus when to rebuild popular snapshots.

## Open Questions For Next Pass
- Should we also capture search clicks or only posting detail views in v1?
- How aggressive should refresh deduplication and batching be?
- Should booking status changes beyond create/confirm affect user preference strength?
