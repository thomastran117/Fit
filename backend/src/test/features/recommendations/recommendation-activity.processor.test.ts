import { RecommendationActivityProcessor } from "@/features/recommendations/recommendation-activity.processor";

describe("RecommendationActivityProcessor", () => {
  it("coalesces posting views into 15-minute actor buckets and schedules user plus popular refresh jobs", async () => {
    const persistActivityAndRefreshJobs = jest.fn(async () => undefined);
    const processor = new RecommendationActivityProcessor({
      findPostingSummary: jest.fn(async () => ({
        id: "posting-1",
        ownerId: "owner-1",
        family: "place",
        subtype: "entire_place",
      })),
      persistActivityAndRefreshJobs,
    } as never);

    await processor.process({
      eventId: "event-1",
      eventType: "posting_view",
      occurredAt: "2026-04-30T12:07:00.000Z",
      postingId: "posting-1",
      actorUserId: "user-1",
      deviceType: "desktop",
      source: "posting_detail",
      personalizationEnabled: true,
    });

    expect(persistActivityAndRefreshJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregationKey:
          "posting_view|posting_detail|posting-1|user:user-1|2026-04-30T12:00:00.000Z",
        personalizationEligible: true,
        coalesced: true,
      }),
      expect.arrayContaining([
        expect.objectContaining({
          jobType: "user_refresh",
          dedupeKey: "user:user-1",
        }),
        expect.objectContaining({
          jobType: "popular_refresh",
          dedupeKey: "popular:global",
        }),
        expect.objectContaining({
          jobType: "popular_refresh",
          dedupeKey: "popular:family:place",
        }),
        expect.objectContaining({
          jobType: "popular_refresh",
          dedupeKey: "popular:family_subtype:place:entire_place",
        }),
      ]),
    );
  });

  it("keeps opted-out signed-in activity out of personalized refreshes", async () => {
    const persistActivityAndRefreshJobs = jest.fn(async () => undefined);
    const processor = new RecommendationActivityProcessor({
      findPostingSummary: jest.fn(async () => ({
        id: "posting-1",
        ownerId: "owner-1",
        family: "vehicle",
        subtype: "car",
      })),
      persistActivityAndRefreshJobs,
    } as never);

    await processor.process({
      eventId: "event-2",
      eventType: "search_click",
      occurredAt: "2026-04-30T12:07:00.000Z",
      postingId: "posting-1",
      actorUserId: "user-1",
      deviceType: "desktop",
      source: "search_results",
      personalizationEnabled: false,
    });

    const [activity, jobs] = persistActivityAndRefreshJobs.mock.calls[0] ?? [];
    expect(activity.personalizationEligible).toBe(false);
    expect(jobs).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jobType: "user_refresh",
        }),
      ]),
    );
    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: "popular:global",
        }),
      ]),
    );
  });

  it("does not coalesce booking request creation events", async () => {
    const persistActivityAndRefreshJobs = jest.fn(async () => undefined);
    const processor = new RecommendationActivityProcessor({
      findPostingSummary: jest.fn(async () => ({
        id: "posting-1",
        ownerId: "owner-1",
        family: "equipment",
        subtype: "camera",
      })),
      persistActivityAndRefreshJobs,
    } as never);

    await processor.process({
      eventId: "event-3",
      eventType: "booking_request_created",
      occurredAt: "2026-04-30T12:07:00.000Z",
      postingId: "posting-1",
      actorUserId: "user-1",
      deviceType: "desktop",
      source: "booking_flow",
      personalizationEnabled: true,
    });

    expect(persistActivityAndRefreshJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregationKey: "event-3",
        coalesced: false,
      }),
      expect.any(Array),
    );
  });
});
