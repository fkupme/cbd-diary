export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, any>;
  timestamp: string;
  path: string;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  metadata: PaginationMetadata;
  timestamp: string;
  path: string;
}

export interface ErrorResponse extends ApiResponse {
  success: false;
  statusCode: number;
  error: string;
}
