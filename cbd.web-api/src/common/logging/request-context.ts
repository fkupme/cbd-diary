import { randomUUID } from 'crypto';

export interface RequestLogContext {
  id: string; // correlation id
  startHrTime: [number, number];
}

export function createRequestLogContext(): RequestLogContext {
  return {
    id: randomUUID(),
    startHrTime: process.hrtime(),
  };
}

export function getDurationMs(startHrTime: [number, number]): number {
  const diff = process.hrtime(startHrTime);
  return diff[0] * 1000 + diff[1] / 1e6;
}
