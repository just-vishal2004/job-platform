import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      const { rows } = await pool.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (rows.length > 0) {
        console.log(`  skipping  ${filename} (already applied)`);
        continue;
      }

      console.log(`  applying  ${filename}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`  ✓ applied  ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    console.log('\nAll migrations complete.\n');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
