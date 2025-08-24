import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import databaseConfig from '../config/database.config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject(databaseConfig.KEY)
    private readonly dbConfig: ConfigType<typeof databaseConfig>,
  ) {
    // Временное диагностическое логирование подключения (без пароля)
    try {
      const safeUrl = new URL(dbConfig.url);
      console.log(
        `[PrismaService] DB connect → host=${safeUrl.hostname} port=${safeUrl.port} db=${safeUrl.pathname.replace(/^\//, '')} user=${decodeURIComponent(
          safeUrl.username || 'postgres',
        )} (source=${process.env.DATABASE_URL ? 'DATABASE_URL' : 'POSTGRES_*'})`,
      );
    } catch (e) {
      console.log(
        '[PrismaService] DB URL parse failed, url is empty or invalid',
      );
    }

    super({
      datasources: {
        db: {
          url: dbConfig.url,
        },
      },
      // Disable Prisma default logging; we log at API layer instead
      log: [],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Метод для очистки базы данных (для тестов)
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const tablenames = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        try {
          await this.$executeRawUnsafe(
            `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
          );
        } catch (error) {
          console.log(`Error truncating ${tablename}:`, error);
        }
      }
    }
  }
}
