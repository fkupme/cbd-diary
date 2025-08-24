import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { createErrorResponse } from '../helpers/response.helper';
import { redactSensitive } from './redact.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: any) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? (exception as HttpException).getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttp
      ? (exception as HttpException).message
      : 'Internal server error';

    const path = request.originalUrl || request.url;

    const errorPayload = createErrorResponse(message, path, status);

    this.logException(exception, request, status);

    response.status(status).json(errorPayload);
  }

  private logException(exception: unknown, request: Request, status: number) {
    try {
      const base = {
        method: request.method,
        url: request.originalUrl,
        statusCode: status,
        params: redactSensitive(request.params),
        query: redactSensitive(request.query),
        body: redactSensitive(request.body),
      };

      if (exception instanceof HttpException) {
        const res = exception.getResponse() as any;
        this.logger?.warn?.(
          { ...base, error: redactSensitive(res) },
          'HTTP exception',
        );
      } else if (exception && typeof exception === 'object') {
        const errObj = exception as any;
        this.logger?.error?.(
          {
            ...base,
            name: errObj?.name,
            message: errObj?.message,
            stack:
              process.env.NODE_ENV === 'production' ? undefined : errObj?.stack,
          },
          'Unhandled exception',
        );
      } else {
        this.logger?.error?.({ ...base, exception }, 'Unknown exception');
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error('Failed to log exception');
    }
  }
}
