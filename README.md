# WB Repricer - Автоматизация ценообразования для Wildberries

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
# Из корневой директории
npm install

# Или отдельно для backend
cd backend
npm install
```

### 2. Настройка окружения

```bash
# Скопируйте .env.example
cp .env.example .env

# Отредактируйте .env файл (укажите свои данные)
nano .env
```

### 3. Запуск базы данных (Docker)

```bash
# Запустить PostgreSQL и Redis
docker-compose -f docker-compose.dev.yml up -d

# Проверить статус
docker-compose -f docker-compose.dev.yml ps
```

### 4. Миграции базы данных

```bash
cd backend

# Сгенерировать Prisma Client
npm run prisma:generate

# Применить миграции
npm run prisma:migrate

# (Опционально) Заполнить тестовыми данными
npm run prisma:seed
```

### 5. Запуск сервера

```bash
# Development mode (с hot reload)
npm run dev

# Production build
npm run build
npm start
```

Сервер запустится на http://localhost:3000

## 📋 Доступные команды

### Backend

```bash
npm run dev              # Запуск в dev режиме
npm run build            # Собрать для production
npm start                # Запустить production build
npm run prisma:generate  # Сгенерировать Prisma Client
npm run prisma:migrate   # Применить миграции
npm run prisma:studio    # Открыть Prisma Studio (GUI для БД)
npm run prisma:seed      # Заполнить БД тестовыми данными
npm run worker:fetcher   # Запустить worker для сбора данных
npm run worker:reprice   # Запустить worker для репрайсинга
npm test                 # Запустить тесты
```

### Docker

```bash
# Запустить всё
docker-compose -f docker-compose.dev.yml up -d

# Остановить
docker-compose -f docker-compose.dev.yml down

# Посмотреть логи
docker-compose -f docker-compose.dev.yml logs -f

# Перезапустить конкретный сервис
docker-compose -f docker-compose.dev.yml restart postgres
```

## 🏗 Структура проекта

```
wb-repricer/
├── backend/              # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── api/          # REST API контроллеры и роуты
│   │   ├── core/         # Ядро системы (стратегии, экономика)
│   │   ├── services/     # Сервисы (WB API, аналитика)
│   │   ├── workers/      # Воркеры для фоновых задач
│   │   ├── models/       # TypeScript модели
│   │   ├── config/       # Конфигурация
│   │   └── utils/        # Утилиты
│   ├── prisma/           # Prisma ORM
│   │   └── schema.prisma # Схема базы данных
│   └── tests/            # Тесты
│
├── frontend/             # Frontend (Next.js + React)
│   └── (будет добавлено позже)
│
├── shared/               # Общие типы и константы
│   ├── types/
│   └── constants/
│
└── docker-compose.dev.yml  # Docker конфигурация
```

## 🗄 База данных

### Основные таблицы:

- **users** - пользователи системы
- **skus** - товары (Stock Keeping Units)
- **strategies** - стратегии ценообразования
- **sku_strategies** - связь SKU и стратегий
- **price_history** - история изменений цен
- **signals** - сигналы для репрайсинга
- **price_rejections** - отклонённые изменения (для анализа)
- **market_data** - кеш данных о конкурентах

### Prisma Studio

Для визуального управления БД:

```bash
cd backend
npm run prisma:studio
```

Откроется на http://localhost:5555

## 🧪 Тестирование

```bash
# Все тесты
npm test

# Тесты с watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 📦 Этапы разработки (MVP)

### ✅ Этап 1: Инфраструктура (Завершён)
- [x] Docker setup
- [x] Prisma schema
- [x] Shared types
- [x] Базовый Express server

### 🔄 Этап 2: Core Engine (В процессе)
- [ ] Strategy Engine
- [ ] Economics Engine
- [ ] Reprice Orchestrator

### ⏳ Этап 3: Signals + Workers
- [ ] Signal Processor
- [ ] Data Fetcher Worker
- [ ] Reprice Worker

### ⏳ Этап 4: API
- [ ] Auth (JWT)
- [ ] SKU CRUD
- [ ] Strategy CRUD
- [ ] Analytics

### ⏳ Этап 5: Frontend
- [ ] Dashboard
- [ ] SKU Management
- [ ] Strategy Builder

## 🐛 Troubleshooting

### Проблема: Не запускается база данных

```bash
# Проверить статус
docker-compose -f docker-compose.dev.yml ps

# Посмотреть логи
docker-compose -f docker-compose.dev.yml logs postgres

# Пересоздать volume
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Проблема: Prisma ошибки

```bash
# Пересоздать клиент
rm -rf node_modules/.prisma
npm run prisma:generate

# Сбросить БД (ВНИМАНИЕ: удалит все данные!)
npx prisma migrate reset
```

### Проблема: Порт 3000 занят

```bash
# Найти процесс
lsof -i :3000

# Убить процесс
kill -9 <PID>

# Или изменить порт в .env
PORT=3001
```

## 📝 Логи

Логи сохраняются в `backend/logs/`:
- `error.log` - только ошибки
- `combined.log` - все логи

В development режиме логи также выводятся в консоль.

## 🤝 Контрибьюция

(Will be added later)

## 📄 Лицензия

(Will be added later)

---

**Статус**: MVP в разработке
**Версия**: 1.0.0
**Дата**: 2026-01-28
