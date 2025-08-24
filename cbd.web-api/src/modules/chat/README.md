# Chat Module

- REST:
  - POST `/chat/entries/:entryId` — создать или вернуть чат по записи
  - GET `/chat/entries/:entryId` — получить чат по записи
  - GET `/chat/:chatId/messages` — список сообщений
  - POST `/chat/:chatId/messages` — отправить сообщение

- WebSocket (Socket.IO):
  - Namespace: `/ws/chat`
  - Events:
    - `join` { chatId }
    - `message` { chatId, role, content }

Аутентификация WS не реализована (TODO).
