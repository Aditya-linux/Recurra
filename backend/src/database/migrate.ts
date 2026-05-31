import { dbPool } from './index.js';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const client = await dbPool.connect();
  try {
    console.log('Resetting schema...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    
    console.log('Running migrations...');
    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();
    
    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Executing ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
      }
    }
    console.log('All migrations applied successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
