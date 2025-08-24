import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  url: string;
}

export default registerAs('database', (): DatabaseConfig => {
  // Если задана DATABASE_URL, используем её как источник истины (совместимо с Prisma CLI)
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      const host = parsed.hostname || 'localhost';
      const port = parseInt(parsed.port || '5432', 10);
      const username = decodeURIComponent(parsed.username || 'postgres');
      const password = decodeURIComponent(parsed.password || '');
      const database =
        (parsed.pathname || '/cbd_diary').replace(/^\//, '') || 'cbd_diary';

      return {
        host,
        port,
        username,
        password,
        database,
        url: databaseUrl,
      };
    } catch {
      // Если парсинг не удался, упадём обратно на POSTGRES_*
    }
  }

  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const username = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'password';
  const database = process.env.POSTGRES_DB || 'cbd_diary';

  const url = `postgresql://${username}:${password}@${host}:${port}/${database}?schema=public`;

  return {
    host,
    port,
    username,
    password,
    database,
    url,
  };
});
