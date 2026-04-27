import { SEED_BOOKINGS } from "@/seeds/fixtures/bookings";

describe("seeded booking payment fixtures", () => {
  it("does not leave seeded payments in worker-active states", () => {
    for (const booking of SEED_BOOKINGS) {
      if (!booking.payment) {
        continue;
      }

      expect(booking.payment.status).not.toBe("processing");
      expect(booking.payment.status).not.toBe("failed_retryable");

      for (const attempt of booking.payment.attempts) {
        expect(attempt.status).not.toBe("processing");
        expect(attempt.status).not.toBe("failed_retryable");
      }

      if (booking.payment.payout) {
        expect(booking.payment.payout.status).toBe("released");
      }
    }
  });

  it("does not leave succeeded seeded payments waiting on repair work", () => {
    for (const booking of SEED_BOOKINGS) {
      if (booking.payment?.status !== "succeeded") {
        continue;
      }

      expect(booking.renting).toBeDefined();
      expect(booking.paymentReconciliationRequired ?? false).toBe(false);
    }
  });
});
