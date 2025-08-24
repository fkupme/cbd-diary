import {
  ApiResponse,
  PaginatedResponse,
  PaginationMetadata,
} from '../types/api-response.type';

export function createApiResponse<T>(
  data: T,
  path: string,
  success: boolean = true,
  message?: string,
): ApiResponse<T> {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString(),
    path,
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  metadata: PaginationMetadata,
  path: string,
  success: boolean = true,
): PaginatedResponse<T> {
  return {
    success,
    data,
    metadata,
    timestamp: new Date().toISOString(),
    path,
  };
}

export function createErrorResponse(
  error: string,
  path: string,
  statusCode: number = 400,
  message?: string,
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    message: message || error,
    errors: { error },
    timestamp: new Date().toISOString(),
    path,
  };
}
