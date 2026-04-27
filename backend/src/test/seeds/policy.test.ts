import { resolveAutoSeedPolicy } from "@/seeds/policy";

describe("resolveAutoSeedPolicy", () => {
  it("skips in production even when enabled", () => {
    expect(
      resolveAutoSeedPolicy({
        autoSeedEnabled: true,
        autoSeedRefresh: true,
        nodeEnv: "production",
        userCount: 0,
      }),
    ).toEqual({
      shouldRun: false,
      refresh: false,
      reason: "production-environment",
    });
  });

  it("skips when auto-seeding is disabled", () => {
    expect(
      resolveAutoSeedPolicy({
        autoSeedEnabled: false,
        autoSeedRefresh: false,
        nodeEnv: "development",
        userCount: 0,
      }),
    ).toEqual({
      shouldRun: false,
      refresh: false,
      reason: "disabled",
    });
  });

  it("runs a refresh when requested", () => {
    expect(
      resolveAutoSeedPolicy({
        autoSeedEnabled: true,
        autoSeedRefresh: true,
        nodeEnv: "test",
        userCount: 5,
      }),
    ).toEqual({
      shouldRun: true,
      refresh: true,
      reason: "refresh-requested",
    });
  });

  it("skips when the database is not empty and refresh is not requested", () => {
    expect(
      resolveAutoSeedPolicy({
        autoSeedEnabled: true,
        autoSeedRefresh: false,
        nodeEnv: "development",
        userCount: 1,
      }),
    ).toEqual({
      shouldRun: false,
      refresh: false,
      reason: "database-not-empty",
    });
  });

  it("runs on an empty dev database", () => {
    expect(
      resolveAutoSeedPolicy({
        autoSeedEnabled: true,
        autoSeedRefresh: false,
        nodeEnv: "development",
        userCount: 0,
      }),
    ).toEqual({
      shouldRun: true,
      refresh: false,
      reason: "empty-database",
    });
  });
});
