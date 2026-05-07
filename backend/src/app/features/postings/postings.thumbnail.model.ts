export interface PostingThumbnailJobPayload {
  jobId: string;
  postingId: string;
  attempt: number;
  occurredAt: string;
}
