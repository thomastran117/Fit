import { createHash } from "node:crypto";
import type { ClientRequestContext } from "@/configuration/http/bindings";
import BadRequestError from "@/errors/http/bad-request.error";
import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type {
  ListRentingAnalyticsInput,
  OwnerRentingsAnalyticsSummary,
  RentingAnalyticsDetail,
  RentingAnalyticsDetailInput,
} from "@/features/rentings/rentings.analytics.model";
import type { RentingsAnalyticsRepository } from "@/features/rentings/rentings.analytics.repository";
import type { PublicRentingRecord, RentingRecord } from "@/features/rentings/rentings.model";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

export class RentingsAnalyticsService {
  constructor(
    private readonly analyticsRepository: RentingsAnalyticsRepository,
    private readonly rentingsRepository: RentingsRepository,
  ) {}

  async trackPublicView(
    renting: RentingRecord | PublicRentingRecord,
    client: ClientRequestContext,
    viewerUserId?: string,
  ): Promise<void> {
    if (renting.status !== "published" || renting.archivedAt) {
      return;
    }

    if (viewerUserId && viewerUserId === renting.ownerId) {
      return;
    }

    if (client.device.type === "bot") {
      return;
    }

    const occurredAt = new Date();
    const viewerHash = this.createViewerHash(renting.id, occurredAt, client, viewerUserId);

    await this.analyticsRepository.enqueueRentingViewedEvent({
      rentingId: renting.id,
      ownerId: renting.ownerId,
      occurredAt: occurredAt.toISOString(),
      viewerHash,
      userId: viewerUserId,
      ipAddressHash: client.ip ? this.hashValue(`ip:${client.ip}`) : undefined,
      userAgentHash: client.device.userAgent
        ? this.hashValue(`ua:${client.device.userAgent}`)
        : undefined,
      deviceType: client.device.type,
    });
  }

  async getOwnerSummary(ownerId: string, window: "7d" | "30d" | "all"): Promise<OwnerRentingsAnalyticsSummary> {
    return this.analyticsRepository.getOwnerSummary({
      ownerId,
      window,
    });
  }

  async listOwnerRentingsAnalytics(input: ListRentingAnalyticsInput) {
    return this.analyticsRepository.listOwnerRentingsAnalytics(input);
  }

  async getRentingAnalyticsDetail(input: RentingAnalyticsDetailInput): Promise<RentingAnalyticsDetail> {
    const renting = await this.rentingsRepository.findById(input.rentingId);

    if (!renting) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    if (renting.ownerId !== input.ownerId) {
      throw new ForbiddenError("You do not have access to this renting analytics.");
    }

    if (input.window !== "7d" && input.granularity === "hour") {
      throw new BadRequestError("Hourly analytics are only supported for the 7d window.");
    }

    const detail = await this.analyticsRepository.getRentingAnalyticsDetail(input);

    if (!detail) {
      throw new ResourceNotFoundError("Renting analytics could not be found.");
    }

    return detail;
  }

  private createViewerHash(
    rentingId: string,
    occurredAt: Date,
    client: ClientRequestContext,
    viewerUserId?: string,
  ): string {
    const dayBucket = occurredAt.toISOString().slice(0, 10);

    if (viewerUserId) {
      return this.hashValue(`renting:${rentingId}:day:${dayBucket}:user:${viewerUserId}`);
    }

    const fingerprintComponents = [
      `renting:${rentingId}`,
      `day:${dayBucket}`,
      `ip:${client.ip ?? "unknown"}`,
      `ua:${client.device.userAgent ?? "unknown"}`,
      `device:${client.device.id ?? "unknown"}`,
    ];

    return this.hashValue(fingerprintComponents.join("|"));
  }

  private hashValue(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
