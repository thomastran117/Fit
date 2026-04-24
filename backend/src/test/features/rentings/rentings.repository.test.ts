import { Prisma } from "@prisma/client";
import ConflictError from "@/errors/http/conflict.error";
import { RentingsRepository } from "@/features/rentings/rentings.repository";

describe("RentingsRepository", () => {
  it("maps a duplicate bookingRequestId unique constraint to ConflictError", async () => {
    const error = Object.assign(new Error("duplicate renting"), {
      code: "P2002",
      clientVersion: "test",
    });
    Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);

    const database = {
      $transaction: async () => {
        throw error;
      },
    };

    const repository = new RentingsRepository(database as never);

    await expect(
      repository.convertApprovedBookingRequest("booking-1", "owner-1"),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
