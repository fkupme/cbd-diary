import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { redactSensitive } from './redact.util';
import { createRequestLogContext, getDurationMs } from './request-context';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: any) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    // correlation and timing
    const ctx = createRequestLogContext();
    res.setHeader('X-Request-Id', ctx.id);

    const { method, originalUrl, ip } = req as any;

    const requestLog = {
      id: ctx.id,
      method,
      url: originalUrl,
      ip,
      params: redactSensitive(req.params),
      query: redactSensitive(req.query),
      body: redactSensitive(req.body),
      headers: redactSensitive(req.headers),
    };

    this.safeLog('info', 'Incoming request', requestLog);

    return next.handle().pipe(
      tap((data) => {
        const durationMs = getDurationMs(ctx.startHrTime);
        const statusCode = res.statusCode;
        const responseLog = {
          id: ctx.id,
          method,
          url: originalUrl,
          statusCode,
          durationMs,
          response: redactSensitive(data),
        } as const;
        this.safeLog('info', 'Outgoing response', responseLog);
      }),
      catchError((err) => {
        const durationMs = getDurationMs(ctx.startHrTime);
        const statusCode = (err as any)?.status || res.statusCode || 500;
        const errorLog = {
          id: ctx.id,
          method,
          url: originalUrl,
          statusCode,
          durationMs,
          message: (err as any)?.message,
          name: (err as any)?.name,
          stack:
            process.env.NODE_ENV === 'production'
              ? undefined
              : (err as any)?.stack,
          cause: redactSensitive((err as any)?.cause),
        } as const;
        this.safeLog('error', 'Request failed', errorLog);
        throw err;
      }),
    );
  }

  private safeLog(
    level: 'info' | 'error' | 'warn' | 'debug',
    msg: string,
    obj?: Record<string, unknown>,
  ) {
    try {
      const payload: Record<string, unknown> =
        obj && typeof obj === 'object'
          ? obj
          : obj !== undefined
            ? { value: obj }
            : {};

      if (this.logger?.[level]) {
        this.logger[level]({ ...payload }, msg);
      } else if (this.logger?.log) {
        this.logger.log({ level, ...payload, msg });
      } else {
        // eslint-disable-next-line no-console
        console.log(level.toUpperCase(), msg, payload);
      }
    } catch {
      // eslint-disable-next-line no-console
      console.log('LOGGING_ERROR', msg);
    }
  }
}
