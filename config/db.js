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
          y_nghia_van_hoa TEXT,
          dan_toc TEXT,
          vung_van_hoa TEXT,
          vi_tri_kho TEXT
        );
      `);

      try { await db.exec(`ALTER TABLE HienVat ADD COLUMN dan_toc TEXT;`); } catch (e) { }
      try { await db.exec(`ALTER TABLE HienVat ADD COLUMN vung_van_hoa TEXT;`); } catch (e) { }
      try { await db.exec(`ALTER TABLE HienVat ADD COLUMN vi_tri_kho TEXT;`); } catch (e) { }

      // Auto-create Users table if not exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
          user_id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT DEFAULT 'STAFF',
          avatar TEXT,
          is_locked INTEGER DEFAULT 0
        );
      `);

      try {
        await db.exec(`ALTER TABLE Users ADD COLUMN avatar TEXT;`);
      } catch (e) { }
      try {
        await db.exec(`ALTER TABLE Users ADD COLUMN is_locked INTEGER DEFAULT 0;`);
      } catch (e) { }

      const existingUser = await db.get('SELECT user_id FROM Users LIMIT 1');
      if (!existingUser) {
        await db.run(`
          INSERT INTO Users (username, password, full_name, email, phone, role, avatar)
          VALUES 
          ('admin', 'admin123', 'Phạm Đức Quang', 'admin@baotang.gov.vn', '0909090909', 'ADMIN', 'avatar/01.jpg'),
          ('banve01', 'password123', 'Trần Thị Mai', 'mai.tran@baotang.gov.vn', '0912345678', 'BANVE', 'avatar/02.jpg'),
          ('thukho01', 'password123', 'Lê Hoàng Nam', 'nam.le@baotang.gov.vn', '0934567890', 'THUKHO', 'avatar/05.jpg');
        `);
      }

      // Auto-create LoaiVe table if not exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS LoaiVe (
          loaive_id INTEGER PRIMARY KEY AUTOINCREMENT,
          ten_loaive TEXT NOT NULL,
          gia_ve REAL NOT NULL DEFAULT 0.00,
          ghi_chu TEXT
        );
      `);

      // Seed default LoaiVe if table is empty
      const existingLoaiVe = await db.get('SELECT loaive_id FROM LoaiVe LIMIT 1');
      if (!existingLoaiVe) {
        await db.run(`
          INSERT INTO LoaiVe (ten_loaive, gia_ve, ghi_chu)
          VALUES ('Vé Tham Quan Phổ Thông', 30000, 'Vé mặc định')
        `);
      }

      // Auto-create VeThamQuan table if not exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS VeThamQuan (
          ve_id INTEGER PRIMARY KEY AUTOINCREMENT,
          ma_qr TEXT UNIQUE NOT NULL,
          loaive_id INTEGER,
          ten_khach TEXT,
          so_dien_thoai TEXT,
          ngay_tham_quan TEXT,
          khung_gio TEXT,
          so_nguoi_lon INTEGER DEFAULT 0,
          so_sinh_vien INTEGER DEFAULT 0,
          so_tre_em INTEGER DEFAULT 0,
          so_nguoi_nuoc_ngoai INTEGER DEFAULT 0,
          tong_tien REAL DEFAULT 0.00,
          phuong_thuc_thanh_toan TEXT DEFAULT 'QR_BANK',
          trang_thai TEXT DEFAULT 'CHUA_SU_DUNG',
          used_at TEXT,
          ngay_mua TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Auto-create LichDoan table if not exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS LichDoan (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE,
          name TEXT NOT NULL,
          ward TEXT,
          province TEXT,
          target TEXT,
          size TEXT,
          time TEXT,
          guide TEXT,
          status TEXT DEFAULT 'Chờ Đón Tiếp',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Auto-create LichSuMuonTra table if not exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS LichSuMuonTra (
          muontra_id INTEGER PRIMARY KEY AUTOINCREMENT,
          hienvat_id INTEGER NOT NULL,
          ngay_muon TEXT NOT NULL,
          ngay_tra_du_kien TEXT,
          ngay_tra_thuc_te TEXT,
          don_vi_muon TEXT,
          muc_dich TEXT,
          trang_thai TEXT DEFAULT 'DANG_MUON'
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
