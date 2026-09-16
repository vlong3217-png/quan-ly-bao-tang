-- ============================================================
-- DATABASE: HE THONG QUAN LY BAO TANG
-- PHIEN BAN SQLITE
-- ============================================================

PRAGMA foreign_keys = ON;


-- ============================================================
-- 1. BANG NGUOI DUNG
-- ============================================================

CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'DUKHACH'
        CHECK (role IN ('ADMIN', 'THUKHO', 'BANVE', 'DUKHACH')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 2. BANG VUNG VAN HOA
-- ============================================================

CREATE TABLE IF NOT EXISTS VungVanHoa (
    vung_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ten_vung TEXT NOT NULL,
    mo_ta TEXT
);


-- ============================================================
-- 3. BANG DAN TOC
-- ============================================================

CREATE TABLE IF NOT EXISTS DanToc (
    dantoc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ten_dantoc TEXT NOT NULL,
    nhom_ngon_ngu TEXT,
    vung_id INTEGER,

    FOREIGN KEY (vung_id)
        REFERENCES VungVanHoa(vung_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 4. BANG KHU TRUNG BAY / KHO
-- ============================================================

CREATE TABLE IF NOT EXISTS KhuTrungBay (
    khu_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ten_khu TEXT NOT NULL,

    loai_khu TEXT NOT NULL DEFAULT 'TRUNG_BAY_INDOOR'
        CHECK (
            loai_khu IN (
                'KHO_BAO_QUAN',
                'TRUNG_BAY_INDOOR',
                'TRUNG_BAY_OUTDOOR'
            )
        ),

    vi_tri TEXT
);


-- ============================================================
-- 5. BANG HIEN VAT
-- ============================================================

CREATE TABLE IF NOT EXISTS HienVat (
    hienvat_id INTEGER PRIMARY KEY AUTOINCREMENT,

    ma_hienvat TEXT NOT NULL UNIQUE,
    ten_hienvat TEXT NOT NULL,

    hinh_anh TEXT,
    nien_dai TEXT,
    chat_lieu TEXT,
    kich_thuoc TEXT,

    tinh_trang TEXT DEFAULT 'Nguyên vẹn',

    y_nghia_van_hoa TEXT,

    dantoc_id INTEGER,
    khu_id INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (dantoc_id)
        REFERENCES DanToc(dantoc_id)
        ON DELETE SET NULL,

    FOREIGN KEY (khu_id)
        REFERENCES KhuTrungBay(khu_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 6. BANG LICH SU MUON TRA
-- ============================================================

CREATE TABLE IF NOT EXISTS LichSuMuonTra (
    muontra_id INTEGER PRIMARY KEY AUTOINCREMENT,

    hienvat_id INTEGER NOT NULL,

    ngay_muon DATE NOT NULL,
    ngay_tra_du_kien DATE,
    ngay_tra_thuc_te DATE,

    don_vi_muon TEXT,
    muc_dich TEXT,

    trang_thai TEXT DEFAULT 'DANG_MUON'
        CHECK (
            trang_thai IN (
                'DANG_MUON',
                'DA_TRA'
            )
        ),

    FOREIGN KEY (hienvat_id)
        REFERENCES HienVat(hienvat_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 7. BANG LICH SU BAO QUAN
-- ============================================================

CREATE TABLE IF NOT EXISTS LichSuBaoQuan (
    baoquan_id INTEGER PRIMARY KEY AUTOINCREMENT,

    hienvat_id INTEGER NOT NULL,

    ngay_kiem_tra DATE NOT NULL,

    mo_ta_tinh_trang TEXT,
    bien_phap_khac_phuc TEXT,
    nguoi_thuc_hien TEXT,

    FOREIGN KEY (hienvat_id)
        REFERENCES HienVat(hienvat_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 8. BANG LOAI VE
-- ============================================================

CREATE TABLE IF NOT EXISTS LoaiVe (
    loaive_id INTEGER PRIMARY KEY AUTOINCREMENT,

    ten_loaive TEXT NOT NULL,

    gia_ve REAL NOT NULL DEFAULT 0,

    ghi_chu TEXT
);


-- ============================================================
-- 9. BANG VE THAM QUAN
-- ============================================================

CREATE TABLE IF NOT EXISTS VeThamQuan (
    ve_id INTEGER PRIMARY KEY AUTOINCREMENT,

    ma_qr TEXT NOT NULL UNIQUE,

    loaive_id INTEGER NOT NULL,

    user_id INTEGER,

    -- Thong tin khach dat ve
    ten_khach TEXT,
    so_dien_thoai TEXT,

    -- Thong tin lich tham quan
    ngay_tham_quan DATE,
    khung_gio TEXT,

    -- So luong ve
    so_nguoi_lon INTEGER DEFAULT 0,
    so_sinh_vien INTEGER DEFAULT 0,
    so_tre_em INTEGER DEFAULT 0,
    so_nguoi_nuoc_ngoai INTEGER DEFAULT 0,

    -- Thanh tien
    tong_tien REAL DEFAULT 0,

    -- Phuong thuc thanh toan
    phuong_thuc_thanh_toan TEXT DEFAULT 'QR_BANK',

    ngay_mua DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Trang thai ve
    trang_thai TEXT DEFAULT 'CHUA_SU_DUNG'
        CHECK (
            trang_thai IN (
                'CHUA_SU_DUNG',
                'DA_SOAT_VE',
                'HUY'
            )
        ),

    used_at DATETIME,

    FOREIGN KEY (loaive_id)
        REFERENCES LoaiVe(loaive_id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 10. BANG LICH DOAN THAM QUAN
-- ============================================================

CREATE TABLE IF NOT EXISTS LichDoan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    code TEXT NOT NULL UNIQUE,

    name TEXT NOT NULL,

    ward TEXT,
    province TEXT,

    target TEXT,

    size TEXT,

    time TEXT,

    guide TEXT,

    status TEXT DEFAULT 'Chờ Đón Tiếp',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_hienvat_ma
ON HienVat(ma_hienvat);


CREATE INDEX IF NOT EXISTS idx_hienvat_ten
ON HienVat(ten_hienvat);


CREATE INDEX IF NOT EXISTS idx_hienvat_dantoc
ON HienVat(dantoc_id);


CREATE INDEX IF NOT EXISTS idx_hienvat_khu
ON HienVat(khu_id);


CREATE INDEX IF NOT EXISTS idx_muontra_hienvat
ON LichSuMuonTra(hienvat_id);


CREATE INDEX IF NOT EXISTS idx_muontra_trangthai
ON LichSuMuonTra(trang_thai);


CREATE INDEX IF NOT EXISTS idx_ve_maqr
ON VeThamQuan(ma_qr);


CREATE INDEX IF NOT EXISTS idx_ve_trangthai
ON VeThamQuan(trang_thai);


CREATE INDEX IF NOT EXISTS idx_ve_ngaythamquan
ON VeThamQuan(ngay_tham_quan);


CREATE INDEX IF NOT EXISTS idx_lichdoan_code
ON LichDoan(code);


CREATE INDEX IF NOT EXISTS idx_lichdoan_status
ON LichDoan(status);


-- ============================================================
-- DU LIEU MAU
-- ============================================================


-- ------------------------------------------------------------
-- VUNG VAN HOA
-- ------------------------------------------------------------

INSERT OR IGNORE INTO VungVanHoa
(vung_id, ten_vung, mo_ta)
VALUES
(
    1,
    'Vùng Việt Bắc',
    'Khu vực trưng bày di sản văn hóa các dân tộc vùng núi phía Bắc'
),
(
    2,
    'Vùng Tây Nguyên',
    'Khu vực không gian văn hóa cồng chiêng và nhà Rông Tây Nguyên'
);


-- ------------------------------------------------------------
-- DAN TOC
-- ------------------------------------------------------------

INSERT OR IGNORE INTO DanToc
(dantoc_id, ten_dantoc, nhom_ngon_ngu, vung_id)
VALUES
(
    1,
    'Tày',
    'Tày - Thái',
    1
),
(
    2,
    'Gia Rai',
    'Môn - Khmer',
    2
);


-- ------------------------------------------------------------
-- KHU TRUNG BAY
-- ------------------------------------------------------------

INSERT OR IGNORE INTO KhuTrungBay
(khu_id, ten_khu, loai_khu, vi_tri)
VALUES
(
    1,
    'Phòng Trưng Bày 1',
    'TRUNG_BAY_INDOOR',
    'Tầng 1 - Khu A'
),
(
    2,
    'Phòng Trưng Bày 2',
    'TRUNG_BAY_INDOOR',
    'Tầng 1 - Khu B'
),
(
    3,
    'Phòng Trưng Bày 3',
    'TRUNG_BAY_INDOOR',
    'Tầng 2 - Khu A'
),
(
    4,
    'Phòng Trưng Bày 4',
    'TRUNG_BAY_INDOOR',
    'Tầng 2 - Khu B'
),
(
    5,
    'Phòng Trưng Bày 5',
    'TRUNG_BAY_INDOOR',
    'Tầng 2 - Khu C'
),
(
    6,
    'Kho Bảo Quản 1',
    'KHO_BAO_QUAN',
    'Tầng Hầm - Khu B'
);


-- ------------------------------------------------------------
-- LOAI VE
-- ------------------------------------------------------------

INSERT OR IGNORE INTO LoaiVe
(loaive_id, ten_loaive, gia_ve, ghi_chu)
VALUES
(
    1,
    'Vé Tham Quan Bảo Tàng',
    30000,
    'Vé vào cổng phổ thông'
),
(
    2,
    'Vé Trẻ Em Dưới 5 Tuổi',
    0,
    'Miễn phí 100% cho trẻ em dưới 5 tuổi'
);


-- ============================================================
-- KET THUC
-- ============================================================