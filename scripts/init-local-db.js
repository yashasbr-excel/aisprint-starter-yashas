const Database = require('better-sqlite3');
const { join } = require('path');
const { existsSync, mkdirSync, readFileSync } = require('fs');

// Create data directory
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Open database
const dbPath = join(dataDir, 'local.db');
const db = new Database(dbPath);

console.log('📂 Initializing local SQLite database:', dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Read and execute migration
const migrationPath = join(process.cwd(), 'migrations', '0001_create_auth_tables.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log(`\n📝 Executing migration...\n`);

try {
  // Execute the entire migration as one script
  db.exec(migrationSQL);
  console.log(`✅ Migration executed successfully`);
} catch (error) {
  // Ignore "already exists" errors
  if (!error.message.includes('already exists')) {
    console.error(`❌ Error executing migration:`, error.message);
    throw error;
  } else {
    console.log(`ℹ️  Tables already exist, skipping creation`);
  }
}

// Verify tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('\n📊 Database tables:');
tables.forEach(t => console.log(`   - ${t.name}`));

const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('\n🔍 Database indexes:');
indexes.forEach(i => console.log(`   - ${i.name}`));

db.close();
console.log('\n✅ Local database initialized successfully!\n');

