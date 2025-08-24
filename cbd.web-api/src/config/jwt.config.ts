import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpire: string;
  refreshExpire: string;
}

export default registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret:
      process.env.JWT_ACCESS_SECRET || 'your-super-secret-jwt-access-key',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'your-super-secret-jwt-refresh-key',
    accessExpire: process.env.JWT_ACCESS_EXPIRE || '15m',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  }),
);
