# PostgreSQL Schema Overview (Prisma)

## Core Entities

- users (User)
- emotion_categories (EmotionCategory)
- emotions (Emotion)
- cbt_entries (CbtEntry)
- translations (Translation)
- sync_operations (SyncOperation)
- user_stats (UserStats)
- chats (Chat)
- chat_messages (ChatMessage)
- chat_finalizations (ChatFinalization)
- user_beliefs (UserBelief)
- device_push_tokens (DevicePushToken)

## Relationships

User 1--_ CbtEntry
User 1--1 UserStats
User 1--_ SyncOperation
User 1--_ Chat
User 1--_ UserBelief
User 1--_ DevicePushToken (nullable userId)
EmotionCategory 1--_ Emotion
Emotion (self) 1--1 oppositeEmotion (optional)
CbtEntry 1--1 Chat (optional)
Chat 1--\* ChatMessage
Chat 1--1 ChatFinalization (optional)

## Suggested Additional Tables (Future)

- achievements (gamification)
- emotion_logs (quick emotion captures outside CBT workflow)
- reminders (scheduled notifications)
- ai_sessions (raw AI interaction metadata)

## Index Summary

- cbt_entries: idx_cbt_entries_user_date(user_id, entry_date DESC)
- sync_operations: idx_sync_operations_table_record(table_name, record_id)
- chats: idx_chats_user_id(user_id)
- chat_messages: idx_chat_messages_chat_created(chat_id, created_at)
- user_beliefs: idx_user_belief_user_last(user_id, last_seen_at)
- device_push_tokens: idx_device_push_token_user(user_id)

## Data Flow (Sync)

Mobile creates offline CbtEntry -> marked is_synced=false -> SyncOperation INSERT queued -> server processes -> sets is_synced true, server_id returned. Updates create UPDATE SyncOperation entries.

## Retention / Cleanup

- Chat messages can be soft-pruned after finalization keeping summary.
- Sync operations older than 30d and synced can be archived.

## Security Notes

- Password stored as strong hash (argon2/bcrypt) with per-user salt.
- AI analysis JSON should be size-limited to avoid bloat.

## ER Diagram (Text)

[User]--(1:N)--[CbtEntry]--(0:1)--[Chat]--(1:N)--[ChatMessage]
[Chat]--(0:1)--[ChatFinalization]
[User]--(1:N)--[SyncOperation]
[User]--(1:1)--[UserStats]
[EmotionCategory]--(1:N)--[Emotion]
[Emotion]--(0:1 self)--[Emotion]
[User]--(1:N)--[UserBelief]
[User]--(0:N)--[DevicePushToken]

## Migration Gaps / Suggestions

1. Add ON DELETE CASCADE constraints mirrored at DB level (Prisma handles, verify in SQL).
2. Consider partial index for device_push_tokens(enabled=true) for faster push fanout.
3. Add unique composite index on (user_id, LOWER(text)) in user_beliefs to avoid dup beliefs.
4. Add GIN index on cbt_entries(thoughts) if JSON querying heavy.
5. Add separate table for emotion logs if frequently written to reduce contention with CBT entries.

## Sample Raw SQL (Selected Tables)

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  name text,
  age smallint,
  gender text CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  preferred_language text NOT NULL DEFAULT 'ru',
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  experience_level text,
  meditation_frequency text,
  stress_level smallint,
  sleep_quality smallint,
  timezone text NOT NULL DEFAULT 'UTC',
  date_of_birth timestamptz,
  push_enabled boolean NOT NULL DEFAULT true,
  is_synced boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cbt_entries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date timestamptz NOT NULL,
  situation text NOT NULL,
  thoughts jsonb NOT NULL DEFAULT '[]'::jsonb,
  reactions text NOT NULL,
  mood_score_before smallint,
  mood_score_after smallint,
  entry_duration_minutes int,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_analysis jsonb,
  is_synced boolean NOT NULL DEFAULT false,
  server_id uuid,
  conflict_resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cbt_entries_user_date ON cbt_entries(user_id, entry_date DESC);
```

## Next Steps

- Decide on achievements & reminders scope.
- Implement JSON size constraints (CHECK octet_length(thoughts) < X).
- Add auditing (who changed what) if regulatory requirements demanded.
