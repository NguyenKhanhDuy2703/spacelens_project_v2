/**
 * Represents the actual HTTP response shape after going through
 * the global TransformInterceptor in NestJS (main.ts line 35).
 *
 * Every API response is wrapped as:
 * {
 *   success: true,
 *   statusCode: 200,
 *   message: "...",
 *   data: <T>,
 *   meta: {} | PaginationMeta,
 *   timestamp: "ISO string"
 * }
 */
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta | Record<string, never>;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}
