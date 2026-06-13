#!/bin/sh
# Самопровижн БД при старте прод-контейнера API.
# Делает прод устойчивым к пропаже/пересозданию базы:
#   1) prisma db push — создаёт БД (если её нет) и синхронизирует схему;
#   2) если справочник эмоций пуст — засеивает категории/эмоции/переводы.
# Идемпотентно: при живой БД оба шага — почти no-op.
set -e

echo "[entrypoint] prisma db push (создаём БД при необходимости + схема)…"
npx prisma db push --skip-generate

# Считаем эмоции отдельным процессом; при любой ошибке трактуем как «пусто».
COUNT=$(node -e 'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.emotion.count().then(c=>console.log(c)).catch(()=>console.log(0)).finally(()=>p.$disconnect())' 2>/dev/null || echo 0)

if [ "$COUNT" = "0" ]; then
  echo "[entrypoint] справочник пуст — сидим эмоции/переводы…"
  # best-effort: сид не должен ронять запуск API
  npm run db:seed || echo "[entrypoint] seed failed (продолжаем без справочника)"
else
  echo "[entrypoint] эмоций в базе: $COUNT — сид не нужен"
fi

echo "[entrypoint] старт приложения: $*"
exec "$@"
