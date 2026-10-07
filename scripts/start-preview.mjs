import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';

// Only the isolated, explicitly opted-in preview may initialize its schema.
if (process.env.PREVIEW_DEPLOYMENT !== '1' ||
    new URL(process.env.DATABASE_URL || 'mysql://invalid').pathname !== '/quick_chat_preview') {
  throw new Error('Preview startup requires PREVIEW_DEPLOYMENT=1 and quick_chat_preview database');
}
let connection;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    connection = await mysql.createConnection(process.env.DATABASE_URL);
    break;
  } catch {
    if (attempt === 29) throw new Error('Preview database unavailable after startup retries');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
try {
  const [rows] = await connection.query('SHOW TABLES');
  const names = rows.map(row => Object.values(row)[0]);
  if (names.length && !names.includes('__drizzle_migrations')) {
    throw new Error('Refusing to initialize an existing unrecognized database');
  }
  await migrate(drizzle(connection), { migrationsFolder: './db/migrations' });
  console.log('Preview database migrations complete');
} finally {
  await connection.end();
}
await import('../dist/boot.js');
