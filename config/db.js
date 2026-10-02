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

      // Auto-create Feedbacks table if not exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS Feedbacks (
          feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          rating INTEGER DEFAULT 5,
          category TEXT DEFAULT 'Chung',
          content TEXT NOT NULL,
          status TEXT DEFAULT 'APPROVED',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const existingFeedback = await db.get('SELECT feedback_id FROM Feedbacks LIMIT 1');
      if (!existingFeedback) {
        await db.run(`
          INSERT INTO Feedbacks (name, phone, email, rating, category, content, status, created_at)
          VALUES 
          ('Nguyễn Văn Tuấn', '0912345678', 'tuan.nguyen@gmail.com', 5, 'Trải nghiệm tham quan', 'Không gian trưng bày rất hoành tráng và đậm đà bản sắc 54 dân tộc. Thuyết minh AI nghe rất rõ ràng và truyền cảm!', 'APPROVED', '2026-03-28 09:30:00'),
          ('Lê Mai Anh', '0987654321', 'maianh.le@gmail.com', 5, 'Dịch vụ & Tiện ích', 'Đặt vé trực tuyến qua mã QR vô cùng tiện lợi, không phải xếp hàng chờ đợi. Các hướng dẫn viên rất nhiệt tình.', 'APPROVED', '2026-03-29 14:15:00'),
          ('Trần Hữu Hùng', '0933221100', 'hung.tran@gmail.com', 5, 'Không gian trưng bày', 'Khuôn viên ngoài trời 6 vùng văn hóa tái hiện nhà Rông và nhà sàn rất chân thực, các cháu học sinh rất thích thú.', 'APPROVED', '2026-03-30 16:45:00');
        `);
      }

      // Drop obsolete LichSuMuonTra table if exists
      await db.exec(`DROP TABLE IF EXISTS LichSuMuonTra;`);

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
