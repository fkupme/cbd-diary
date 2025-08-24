export type Primitive = string | number | boolean | null | undefined;

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
]);

export function redactSensitive<T = unknown>(
  input: T,
  maxStringLength = 2000,
): T {
  return redactInternal(input, maxStringLength) as unknown as T;
}

function redactInternal(value: unknown, maxStringLength: number): unknown {
  if (value === null || value === undefined) return value;

  const valueType = typeof value;
  if (valueType === 'string')
    return truncateString(value as string, maxStringLength);
  if (valueType === 'number' || valueType === 'boolean')
    return value as Primitive;

  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) =>
      redactInternal(item, maxStringLength),
    );
  }

  if (valueType === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = maskValue(val);
        continue;
      }

      // Special-case common containers of sensitive values
      if (key.toLowerCase() === 'headers') {
        result[key] = redactHeaders(val);
        continue;
      }

      result[key] = redactInternal(val, maxStringLength);
    }
    return result;
  }

  return undefined;
}

function redactHeaders(headers: unknown): Record<string, unknown> {
  if (!headers || typeof headers !== 'object') return {};
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(headers as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = maskValue(val);
    } else {
      result[key] = typeof val === 'string' ? truncateString(val, 512) : val;
    }
  }
  return result;
}

function maskValue(_val: unknown): string {
  return '[REDACTED]';
}

export function truncateString(text: string, max = 2000): string {
  if (typeof text !== 'string') return text as unknown as string;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…[truncated ${text.length - max} chars]`;
}
