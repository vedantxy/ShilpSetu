# Database Migrations — ShilpSetu Backend

## Overview

This directory contains SQL migrations for tables not managed by Supabase Auth.
Run them **once** in order via the Supabase SQL Editor.

## How to Run

1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Paste and run each migration file **in numbered order**:

| Order | File | Creates |
|-------|------|---------|
| 1 | `001_audit_logs.sql` | `audit_logs` — admin action audit trail |
| 2 | `002_admin_notifications.sql` | `admin_notifications` — system-wide notifications |
| 3 | `003_orders.sql` | `orders` — buyer-seller transaction records |

## Notes

- All migrations are **idempotent** (`CREATE TABLE IF NOT EXISTS`) — safe to re-run
- RLS is enabled on all tables; the backend uses the **service role key** which bypasses RLS
- Do **not** expose the `SUPABASE_SERVICE_ROLE_KEY` to the frontend

## Required `.env` Variables

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```
