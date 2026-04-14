const { Pool } = require('pg');
const path = require('path');

// Use DATABASE_URL for Render.com (Postgres)
// Fallback to a dummy pool if missing (though we expect it in production)
const isProd = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

if (!connectionString && isProd) {
  console.error('❌ DATABASE_URL is missing in production!');
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: isProd ? { rejectUnauthorized: false } : false
});

// Helper to translate SQLite '?' to Postgres '$1, $2...'
function translateSql(sql) {
  let count = 1;
  return sql.replace(/\?/g, () => `$${count++}`);
}

const db = {
  query: (text, params) => pool.query(text, params),
  
  // Compatibility layer for existing sync-style code
  // NOTE: These are now ASYNC and must be awaited in routes
  prepare: (sql) => {
    const pgSql = translateSql(sql);
    
    return {
      all: async (...params) => {
        const res = await pool.query(pgSql, params);
        return res.rows;
      },
      get: async (...params) => {
        const res = await pool.query(pgSql, params);
        return res.rows[0];
      },
      run: async (...params) => {
        // We append RETURNING id if it's an INSERT to mock lastInsertRowid
        let finalSql = pgSql;
        if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
          finalSql += ' RETURNING id';
        }
        
        const res = await pool.query(finalSql, params);
        return { 
          lastInsertRowid: res.rows[0]?.id || null, 
          changes: res.rowCount 
        };
      }
    };
  },
  
  exec: async (sql) => {
    return pool.query(sql);
  },

  transaction: (fn) => {
    return async (...args) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client, ...args);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };
  }
};

// INITIALIZATION LOGIC
async function initDb() {
  console.log('🚀 Initializing PostgreSQL Database...');
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#7c3aed',
      role TEXT NOT NULL DEFAULT 'member',
      avatar_url TEXT,
      timezone TEXT DEFAULT 'UTC',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL DEFAULT 'TF',
      description TEXT DEFAULT '',
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      task_counter INTEGER NOT NULL DEFAULT 0,
      estimated_completion_date TEXT,
      project_goal TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      task_number INTEGER NOT NULL DEFAULT 0,
      task_type TEXT NOT NULL DEFAULT 'task',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      hours_estimated REAL DEFAULT 0,
      estimated_completion TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mimetype TEXT NOT NULL DEFAULT 'application/octet-stream',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hour_logs (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hours REAL NOT NULL CHECK(hours > 0),
      note TEXT DEFAULT '',
      logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_requests (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_links (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      linked_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      link_type TEXT DEFAULT 'relates_to',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(task_id, linked_task_id, link_type)
    );
  `);
  
  console.log('✅ PostgreSQL Schema Verified');
}

// Trigger init (Top-level await isn't available in all node versions easily without ESM, 
// so we'll export the promise or just let it fire)
initDb().catch(err => console.error('❌ DB Init Failed:', err));

module.exports = db;
