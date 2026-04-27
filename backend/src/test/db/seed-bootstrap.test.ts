import {
  bootstrapSeedTestDatabase,
  teardownSeedTestDatabase,
} from "../support/database-seed-harness";
import { getDatabaseClient } from "@/configuration/resources/database";
import { runSeedOrchestrator } from "@/seeds/orchestrator";
import { SEED_POSTINGS } from "@/seeds/fixtures/postings";
import { SEED_BOOKINGS } from "@/seeds/fixtures/bookings";

describe("database seed harness", () => {
  beforeAll(async () => {
    await bootstrapSeedTestDatabase();
  });

  afterAll(async () => {
    await teardownSeedTestDatabase();
  });

  it("creates the expanded fixture dataset", async () => {
    const prisma = getDatabaseClient();

    expect(
      await prisma.posting.count({
        where: {
          id: {
            in: SEED_POSTINGS.map((posting) => posting.id),
          },
        },
      }),
    ).toBe(SEED_POSTINGS.length);

    expect(
      await prisma.bookingRequest.count({
        where: {
          id: {
            in: SEED_BOOKINGS.map((booking) => booking.id),
          },
        },
      }),
    ).toBe(SEED_BOOKINGS.length);
  });

  it("restores fixture-owned rows on refresh", async () => {
    const prisma = getDatabaseClient();
    const seededPosting = SEED_POSTINGS[0];

    await prisma.posting.update({
      where: {
        id: seededPosting.id,
      },
      data: {
        name: "Mutated Local Name",
      },
    });

    await runSeedOrchestrator({
      refresh: true,
      source: "test",
    });

    const restoredPosting = await prisma.posting.findUnique({
      where: {
        id: seededPosting.id,
      },
      select: {
        name: true,
      },
    });

    expect(restoredPosting?.name).toBe(seededPosting.name);
  });
});
