import BadRequestError from "@/errors/http/bad-request.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type { PostingsAnalyticsRepository } from "@/features/postings/postings.analytics.repository";
import type { PaymentProviderAdapter } from "@/features/payments/payment-provider";
import type {
  CreatePaymentSessionInput,
  CreateRefundInput,
  ListPayoutsInput,
  PaymentRecord,
  PayoutListResult,
  RetryPaymentInput,
} from "@/features/payments/payments.model";
import { PaymentsRepository } from "@/features/payments/payments.repository";
import { createPaymentIdempotencyKey } from "@/features/payments/payments.utils";

function readEventPaymentDetails(payload: Record<string, unknown>): {
  paymentId?: string;
  orderId?: string;
  refundId?: string;
  status?: string;
} {
  const entity = (payload.data as Record<string, unknown> | undefined)?.object as Record<string, unknown> | undefined;
  const payment = (entity?.payment as Record<string, unknown> | undefined) ?? entity;
  const refund = (entity?.refund as Record<string, unknown> | undefined) ?? entity;

  return {
    paymentId:
      (payment?.id as string | undefined) ??
      ((payload.payment_id as string | undefined) || undefined),
    orderId: (payment?.order_id as string | undefined) ?? ((payload.order_id as string | undefined) || undefined),
    refundId: (refund?.id as string | undefined) ?? ((payload.refund_id as string | undefined) || undefined),
    status: (payment?.status as string | undefined) ?? (refund?.status as string | undefined),
  };
}

export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly paymentProvider: PaymentProviderAdapter,
    private readonly postingsAnalyticsRepository: PostingsAnalyticsRepository,
  ) {}

  async createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentRecord> {
    const idempotencyKey = createPaymentIdempotencyKey(input.idempotencyKey);
    const attempt = await this.paymentsRepository.createPaymentAttemptForBooking({
      bookingRequestId: input.bookingRequestId,
      renterId: input.renterId,
      idempotencyKey,
    });

    const existingAttempt = attempt.payment.attempts.find(
      (item) => item.id === attempt.attemptId && item.providerRequestId,
    );

    if (existingAttempt) {
      return attempt.payment;
    }

    try {
      const session = await this.paymentProvider.createPaymentSession({
        idempotencyKey,
        amount: attempt.amount,
        currency: attempt.currency,
        bookingRequestId: input.bookingRequestId,
        paymentId: attempt.paymentId,
      });

      return this.paymentsRepository.attachPaymentSession(attempt.paymentId, attempt.attemptId, session);
    } catch (error) {
      const errorInfo = this.paymentProvider.classifyError(error);
      return this.paymentsRepository.recordAttemptFailure(
        attempt.paymentId,
        attempt.attemptId,
        errorInfo,
      );
    }
  }

  async retryPayment(input: RetryPaymentInput): Promise<PaymentRecord> {
    const payment = await this.paymentsRepository.findAccessibleById(input.paymentId, input.renterId);

    if (!["failed_retryable", "failed_final"].includes(payment.status)) {
      throw new BadRequestError("This payment is not eligible for retry.");
    }

    return this.createPaymentSession({
      bookingRequestId: payment.bookingRequestId,
      renterId: input.renterId,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async getPaymentById(paymentId: string, userId: string): Promise<PaymentRecord> {
    return this.paymentsRepository.findAccessibleById(paymentId, userId);
  }

  async createRefund(input: CreateRefundInput): Promise<PaymentRecord> {
    await this.paymentsRepository.findAccessibleById(input.paymentId, input.actorUserId);

    const idempotencyKey = createPaymentIdempotencyKey(input.idempotencyKey);
    const { refundId, providerPaymentId, pricingCurrency } =
      await this.paymentsRepository.createRefundRecord({
        ...input,
        idempotencyKey,
      });

    const result = await this.paymentProvider.createRefund({
      idempotencyKey,
      providerPaymentId,
      amount: input.amount,
      currency: pricingCurrency,
      reason: input.reason,
    });

    return this.paymentsRepository.completeRefund(refundId, result);
  }

  async listPayouts(input: ListPayoutsInput): Promise<PayoutListResult> {
    return this.paymentsRepository.listPayoutsForOwner(input);
  }

  async processSquareWebhook(rawBody: string, signatureHeader: string | undefined): Promise<void> {
    const verification = this.paymentProvider.verifyWebhookSignature(rawBody, signatureHeader);

    const details = readEventPaymentDetails(verification.payload);
    const payment = await this.paymentsRepository.findBySquareReferences({
      squarePaymentId: details.paymentId,
      squareOrderId: details.orderId,
    });

    const stored = await this.paymentsRepository.upsertWebhookEvent({
      providerEventId: verification.eventId,
      eventType: verification.eventType,
      signatureValid: verification.isValid,
      payload: verification.payload,
      paymentId: payment?.id,
    });

    if (!verification.isValid) {
      throw new BadRequestError("Square webhook signature verification failed.");
    }

    if (stored.alreadyProcessed) {
      return;
    }

    if (verification.eventType.startsWith("payment.")) {
      const status = (details.status ?? "").toUpperCase();

      if (status === "COMPLETED") {
        const result = await this.paymentsRepository.markPaymentSucceeded({
          providerPaymentId: details.paymentId,
          providerOrderId: details.orderId,
          status: "COMPLETED",
          raw: verification.payload,
        });

        if (result?.createdRenting) {
          await this.postingsAnalyticsRepository.enqueueRentingConfirmedEvent({
            postingId: result.payment.postingId,
            ownerId: result.payment.ownerId,
            occurredAt: result.payment.succeededAt ?? new Date().toISOString(),
            estimatedTotal: result.payment.rentalSubtotalAmount,
          });
        }
      } else if (status === "FAILED" || status === "CANCELED") {
        await this.paymentsRepository.markPaymentFailed(
          {
            providerPaymentId: details.paymentId,
            providerOrderId: details.orderId,
            status: status === "FAILED" ? "FAILED" : "CANCELED",
            raw: verification.payload,
            failureCode: verification.eventType,
            failureMessage: `Square webhook reported ${status.toLowerCase()}.`,
          },
          status === "FAILED" ? "permanent" : "unknown",
        );
      }
    }

    await this.paymentsRepository.markWebhookProcessed(verification.eventId);
  }

  async reconcilePayment(paymentId: string, userId: string): Promise<PaymentRecord> {
    const payment = await this.paymentsRepository.findAccessibleById(paymentId, userId);
    const status = await this.paymentProvider.getPaymentStatus({
      providerPaymentId: payment.squarePaymentId,
      providerOrderId: payment.squareOrderId,
    });

    if (!status) {
      throw new ResourceNotFoundError("Provider payment could not be found for reconciliation.");
    }

    if (status.status === "COMPLETED") {
      const result = await this.paymentsRepository.markPaymentSucceeded(status);

      if (!result) {
        throw new ResourceNotFoundError("Payment could not be reconciled.");
      }

      if (result.createdRenting) {
        await this.postingsAnalyticsRepository.enqueueRentingConfirmedEvent({
          postingId: result.payment.postingId,
          ownerId: result.payment.ownerId,
          occurredAt: result.payment.succeededAt ?? new Date().toISOString(),
          estimatedTotal: result.payment.rentalSubtotalAmount,
        });
      }

      return result.payment;
    }

    if (status.status === "FAILED" || status.status === "CANCELED") {
      const result = await this.paymentsRepository.markPaymentFailed(
        status,
        status.status === "FAILED" ? "permanent" : "unknown",
      );

      if (!result) {
        throw new ResourceNotFoundError("Payment could not be reconciled.");
      }

      return result;
    }

    return payment;
  }

  async repairPayment(paymentId: string): Promise<void> {
    const payment = await this.paymentsRepository.findById(paymentId);

    if (!payment) {
      return;
    }

    const status = await this.paymentProvider.getPaymentStatus({
      providerPaymentId: payment.squarePaymentId,
      providerOrderId: payment.squareOrderId,
    });

    if (!status) {
      return;
    }

    if (status.status === "COMPLETED") {
      const result = await this.paymentsRepository.markPaymentSucceeded(status);

      if (result?.createdRenting) {
        await this.postingsAnalyticsRepository.enqueueRentingConfirmedEvent({
          postingId: result.payment.postingId,
          ownerId: result.payment.ownerId,
          occurredAt: result.payment.succeededAt ?? new Date().toISOString(),
          estimatedTotal: result.payment.rentalSubtotalAmount,
        });
      }

      return;
    }

    if (status.status === "FAILED" || status.status === "CANCELED") {
      await this.paymentsRepository.markPaymentFailed(
        status,
        status.status === "FAILED" ? "permanent" : "unknown",
      );
    }
  }

  async processRetryQueue(limit: number): Promise<number> {
    const candidates = await this.paymentsRepository.listRetryCandidates(limit);

    for (const candidate of candidates) {
      const ready = await this.paymentsRepository.markAttemptForRetry(candidate.attemptId);

      if (!ready) {
        continue;
      }

      try {
        const session = await this.paymentProvider.createPaymentSession({
          idempotencyKey: ready.idempotencyKey,
          amount: ready.amount,
          currency: ready.currency,
          bookingRequestId: ready.bookingRequestId,
          paymentId: ready.paymentId,
        });

        await this.paymentsRepository.attachPaymentSession(ready.paymentId, candidate.attemptId, session);
      } catch (error) {
        const errorInfo = this.paymentProvider.classifyError(error);
        await this.paymentsRepository.recordAttemptFailure(
          ready.paymentId,
          candidate.attemptId,
          errorInfo,
        );
      }
    }

    return candidates.length;
  }

  async processRepairQueue(limit: number): Promise<number> {
    const candidates = await this.paymentsRepository.listRepairCandidates(limit);

    for (const candidate of candidates) {
      await this.repairPayment(candidate.paymentId);
    }

    return candidates.length;
  }

  async processDuePayouts(limit: number): Promise<number> {
    const payouts = await this.paymentsRepository.listDuePayouts(limit);

    for (const payout of payouts) {
      try {
        await this.paymentsRepository.markPayoutReleased(payout.id);
      } catch (error) {
        await this.paymentsRepository.markPayoutFailed(
          payout.id,
          error instanceof Error ? error.message : "Payout release failed.",
        );
      }
    }

    return payouts.length;
  }
}
