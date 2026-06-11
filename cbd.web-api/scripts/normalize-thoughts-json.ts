import { PrismaClient } from '@prisma/client';
import { normalizeThoughts } from '../src/common/helpers/thoughts.helper';

/**
 * Одноразовая миграция: приводит JSON-поле cbt_entries.thoughts всех записей
 * к каноническому camelCase-формату (см. src/common/helpers/thoughts.helper.ts).
 *
 * Исторические диалекты в колонке:
 *  - snake_case от прямого API (emotion_id, is_automatic, cognitive_distortions-объекты)
 *  - camelCase от sync (emotionId, isAutomatic, cognitiveDistortions)
 *  - строковые cognitive_distortions от старых мобильных клиентов
 *
 * Запуск: npx ts-node scripts/normalize-thoughts-json.ts
 */

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.cbtEntry.findMany({
    select: { id: true, thoughts: true },
  });

  let updated = 0;
  let unchanged = 0;

  for (const entry of entries) {
    const normalized = normalizeThoughts(entry.thoughts);
    const before = JSON.stringify(entry.thoughts);
    const after = JSON.stringify(normalized);
    if (before === after) {
      unchanged++;
      continue;
    }
    await prisma.cbtEntry.update({
      where: { id: entry.id },
      data: { thoughts: normalized as any },
    });
    updated++;
  }

  console.log(
    `✅ Готово: ${updated} записей нормализовано, ${unchanged} уже были в каноническом виде (всего ${entries.length})`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Ошибка миграции:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
