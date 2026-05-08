import type { PostingsPublicCacheService } from "@/features/postings/postings.public-cache.service";

export async function invalidatePublicPostingProjection(
  publicCacheService: Pick<PostingsPublicCacheService, "invalidatePublic">,
  postingId?: string,
): Promise<void> {
  if (!postingId) {
    return;
  }

  await publicCacheService.invalidatePublic(postingId);
}
