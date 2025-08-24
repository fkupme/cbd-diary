import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  apiVersion: string;
  corsOrigin: string | boolean | string[];
  chatSummaryTimeoutMs: number;
  chatSummaryConditionPairs: number;
}

export default registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT || '3002', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || 'api',
    apiVersion: process.env.API_VERSION || 'v1',
    corsOrigin:
      process.env.CORS_ORIGIN ||
      (process.env.NODE_ENV === 'development'
        ? true // В development разрешаем все origins
        : 'http://localhost:5173'),
    chatSummaryTimeoutMs: parseInt(
      process.env.CHAT_SUMMARY_TIMEOUT || '300000',
      10,
    ),
    chatSummaryConditionPairs: parseInt(
      process.env.CHAT_SUMMARY_CONDITION || '3',
      10,
    ),
  }),
);
