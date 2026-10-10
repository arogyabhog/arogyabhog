/**
 * Creates + migrates + seeds the local dev database (local/dev.db).
 * Run: npx vite-node scripts/db-setup.ts
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { seedDatabase } from '../src/db/seed';

const client = createClient({ url: 'file:local/dev.db' });
const db = drizzle(client);
await migrate(db, { migrationsFolder: 'migrations' });
await seedDatabase(db);
console.log('✓ local/dev.db migrated + seeded');
