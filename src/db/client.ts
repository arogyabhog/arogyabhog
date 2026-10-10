/**
 * Process-wide libSQL client. DATABASE_URL is the only switch between the
 * in-process dev/test database and Neon Postgres-proxied prod (ADR-004/023).
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';

export const sqlClient = createClient({
  url: process.env.DATABASE_URL ?? 'file:local/dev.db',
});

export const db = drizzle(sqlClient, { schema });
