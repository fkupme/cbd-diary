<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# CBD Diary Web API

Бэкенд для мобильного приложения CBD Diary на NestJS с PostgreSQL.

## 🚀 Быстрый старт

### 1. Клонируйте проект и установите зависимости

```bash
npm install
```

### 2. Запустите PostgreSQL в Docker

```bash
# Только база данных для разработки
docker-compose up postgres -d

# Или с Redis и Adminer
docker-compose --profile tools up -d
```

### 3. Настройте переменные окружения

```bash
# Скопируйте и отредактируйте .env файл
cp .env.example .env
```

### 4. Выполните миграции и заполните базу

```bash
# Создание миграций и применение
npx prisma migrate dev

# Заполнение начальными данными
npm run db:seed
```

### 5. Запустите приложение

```bash
# Разработка
npm run start:dev

# Продакшн
npm run start:prod
```

## 🐳 Docker команды

```bash
# Запуск только БД для разработки
docker-compose up postgres redis -d

# Запуск с инструментами (Adminer)
docker-compose --profile tools up -d

# Запуск всего в продакшне
docker-compose --profile production up -d

# Остановка всех сервисов
docker-compose down

# Полная очистка (включая данные)
docker-compose down -v
```

## 📋 Доступные скрипты

```bash
# Разработка
npm run start:dev          # Запуск с hot-reload
npm run start:debug        # Запуск с отладкой

# База данных
npm run db:migrate         # Применение миграций
npm run db:generate        # Генерация Prisma клиента
npm run db:seed            # Заполнение начальными данными
npm run db:studio          # Prisma Studio

# Тестирование
npm run test               # Unit тесты
npm run test:e2e           # E2E тесты
npm run test:cov           # Покрытие тестами

# Сборка
npm run build              # Сборка для продакшена
npm run start:prod         # Запуск продакшен версии
```

## 🌐 API Endpoints

### Аутентификация

- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/refresh` - Обновление токена

### Пользователи (TODO)

- `GET /api/users/me` - Текущий пользователь
- `PATCH /api/users/me` - Обновление профиля

### Эмоции (TODO)

- `GET /api/emotions/categories` - Категории эмоций
- `GET /api/emotions` - Список эмоций

### КПТ записи (TODO)

- `GET /api/cbt-entries` - Список записей
- `POST /api/cbt-entries` - Создание записи
- `GET /api/cbt-entries/:id` - Получение записи
- `PATCH /api/cbt-entries/:id` - Обновление записи
- `DELETE /api/cbt-entries/:id` - Удаление записи

## 🛠 Технологии

- **NestJS** - Фреймворк
- **PostgreSQL** - База данных
- **Prisma** - ORM
- **JWT** - Аутентификация
- **bcryptjs** - Хеширование паролей
- **class-validator** - Валидация
- **Docker** - Контейнеризация

## 📁 Структура проекта

```
src/
├── common/           # Общие типы и утилиты
├── config/           # Конфигурация приложения
├── database/         # Сервис базы данных
├── modules/          # Бизнес модули
│   ├── auth/         # Аутентификация
│   ├── users/        # Пользователи (TODO)
│   ├── emotions/     # Эмоции (TODO)
│   └── cbt-entries/  # КПТ записи (TODO)
└── app.module.ts     # Корневой модуль
```

## 🔗 Полезные ссылки

- [NestJS Документация](https://docs.nestjs.com/)
- [Prisma Документация](https://www.prisma.io/docs/)
- [PostgreSQL Документация](https://www.postgresql.org/docs/)

## 📝 TODO

- [ ] Users Module
- [ ] Emotions Module
- [ ] CBT Entries Module
- [ ] Sync Module
- [ ] Analytics Module
- [ ] Testing Setup
- [ ] API Documentation (Swagger)
- [ ] Rate Limiting
- [ ] Caching (Redis)
