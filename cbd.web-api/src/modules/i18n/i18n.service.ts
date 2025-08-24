import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class I18nService {
  constructor(private readonly prisma: PrismaService) {}

  async getTranslations(languageCode: string): Promise<Record<string, string>> {
    const rows = await this.prisma.translation.findMany({
      where: { languageCode },
      select: { translationKey: true, translationValue: true },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.translationKey] = r.translationValue;
    return map;
  }

  async upsertTranslations(
    languageCode: string,
    entries: Record<string, string>,
  ): Promise<number> {
    let count = 0;
    for (const [key, value] of Object.entries(entries)) {
      await this.prisma.translation.upsert({
        where: {
          unique_translation: {
            languageCode,
            translationKey: key,
          },
        } as any,
        create: {
          languageCode,
          translationKey: key,
          translationValue: value,
        },
        update: { translationValue: value },
      });
      count++;
    }
    return count;
  }
}
