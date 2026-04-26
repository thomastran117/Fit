export interface RentifyPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RentifyPostingSummary extends Record<string, unknown> {
  id: string;
  name: string;
}

export interface SearchPostingsResponse extends Record<string, unknown> {
  postings: RentifyPostingSummary[];
  pagination: RentifyPagination;
  source: string;
  query?: string;
}

export interface GetPostingResponse extends Record<string, unknown> {
  id: string;
  name?: string;
  status?: string;
}

export interface BatchGetPostingsResponse extends Record<string, unknown> {
  postings: RentifyPostingSummary[];
  missingIds: string[];
}

export interface PostingReviewRecord extends Record<string, unknown> {
  id: string;
  rating: number;
}

export interface ListPostingReviewsResponse extends Record<string, unknown> {
  reviews: PostingReviewRecord[];
  summary: {
    averageRating: number;
    reviewCount: number;
  };
  pagination: RentifyPagination;
}
