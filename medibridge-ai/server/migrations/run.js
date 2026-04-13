/**
 * Migration Runner
 *
 * Executes SQL migration files in order.
 * Use --fresh flag to drop and recreate all tables.
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const isFresh = process.argv.includes('--fresh');

  console.log('🔄 Starting database migration...');

  // Create connection without database first, with multipleStatements enabled
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  const dbName = process.env.DB_NAME || 'medibridge_ai';

  try {
    if (isFresh) {
      console.log(`⚠️  Fresh migration: Dropping database ${dbName}...`);
      await connection.query(`DROP DATABASE IF EXISTS ${dbName}`);
    }

    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${dbName}\``);

    console.log(`📁 Using database: ${dbName}`);

    // Read and execute migration files in order
    const migrationFiles = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      console.log(`📜 Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');

      // Execute the entire SQL file at once (multipleStatements is enabled)
      try {
        await connection.query(sql);
        console.log(`✅ Completed: ${file}`);
      } catch (error) {
        // Ignore "table already exists" errors when not doing fresh migration
        if (!error.message.includes('already exists') || isFresh) {
          console.error(`❌ Error in ${file}: ${error.message}`);
          throw error;
        }
        console.log(`⚠️  Skipped (already exists): ${file}`);
      }
    }

    // Verify tables were created
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n📋 Tables created: ${tables.length}`);
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`   - ${tableName}`);
    });

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
