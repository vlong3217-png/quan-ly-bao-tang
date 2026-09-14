const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../database.sqlite');
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      console.log('✅ Connected to SQLite Database successfully:', dbPath);

      // Auto-create HienVat table if not exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS HienVat (
          hienvat_id INTEGER PRIMARY KEY AUTOINCREMENT,
          ma_hienvat TEXT UNIQUE,
          ten_hienvat TEXT NOT NULL,
          chat_lieu TEXT,
          hinh_anh TEXT,
          nien_dai TEXT,
          tinh_trang TEXT DEFAULT 'Nguyên vẹn',
          y_nghia_van_hoa TEXT
        );
      `);

      // Auto-create Users table if not exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
          user_id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT DEFAULT 'STAFF'
        );
      `);

      return db;
    })();
  }
  return dbPromise;
}

// Wrapper object mimicking mysql2 interface with query method
const pool = {
  async query(sql, params = []) {
    const db = await getDb();
    const cleanSql = sql.trim();
    const isSelect = cleanSql.toUpperCase().startsWith('SELECT');

    // Convert MySQL 'ON DUPLICATE KEY UPDATE' to SQLite 'ON CONFLICT DO UPDATE'
    let convertedSql = cleanSql.replace(
      /ON\s+DUPLICATE\s+KEY\s+UPDATE\s+(.+)/gi,
      (match, p1) => {
        const updates = p1.split(',').map(s => {
          const parts = s.split('=');
          if (parts.length === 2) {
            const col = parts[0].trim();
            const val = parts[1].trim();
            if (val.toUpperCase().includes('VALUES(')) {
              const valCol = val.match(/VALUES\(([^)]+)\)/i);
              if (valCol) {
                return `${col} = excluded.${valCol[1].trim()}`;
              }
            }
          }
          return s;
        }).join(', ');
        return `ON CONFLICT(ma_hienvat) DO UPDATE SET ${updates}`;
      }
    );

    if (isSelect) {
      const rows = await db.all(convertedSql, params);
      return [rows];
    } else {
      const result = await db.run(convertedSql, params);
      return [{ affectedRows: result.changes, insertId: result.lastID }];
    }
  }
};

module.exports = pool;
