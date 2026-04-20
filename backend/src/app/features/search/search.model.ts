export type SearchIndexJobOperation = "upsert" | "delete" | "barrier";
export type SearchReindexStatus =
  | "pending"
  | "running"
  | "waiting_for_catchup"
  | "completed"
  | "failed";

export interface SearchIndexJobPayload {
  outboxId: string;
  eventId: string;
  dedupeKey: string;
  operation: SearchIndexJobOperation;
  jobType: SearchIndexJobOperation;
  postingId?: string;
  reindexRunId?: string;
  targetIndexScope: "live" | "reindex";
  targetIndexName?: string;
  occurredAt: string;
  attempt: number;
}

export interface SearchReindexRunRecord {
  id: string;
  status: SearchReindexStatus;
  targetIndexName: string;
  retainedIndexName?: string;
  sourceSnapshotAt: string;
  barrierOutboxId?: string;
  totalPostings: number;
  indexedPostings: number;
  failedPostings: number;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  processingAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchQueueCounts {
  ready: number;
  consumers: number;
}

export interface SearchStatusResult {
  aliases: {
    read: string;
    write: string;
    readTargets: string[];
    writeTargets: string[];
  };
  currentReindexRun?: SearchReindexRunRecord;
  pendingOutboxCount: number;
  queueCounts: {
    main: SearchQueueCounts;
    retry1: SearchQueueCounts;
    retry2: SearchQueueCounts;
    retry3: SearchQueueCounts;
    deadLetter: SearchQueueCounts;
  };
}
