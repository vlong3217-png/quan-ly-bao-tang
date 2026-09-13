-- ============================================================
-- SCRIPT KHOI TAO CO SO DU LIEU - HE THONG QUAN LY BAO TANG
-- ============================================================

CREATE DATABASE IF NOT EXISTS quan_ly_bao_tang 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE quan_ly_bao_tang;

-- 1. BANG NGUOI DUNG
CREATE TABLE IF NOT EXISTS Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role ENUM('ADMIN', 'THUKHO', 'BANVE', 'DUKHACH') NOT NULL DEFAULT 'DUKHACH',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BANG VUNG VAN HOA
CREATE TABLE IF NOT EXISTS VungVanHoa (
    vung_id INT AUTO_INCREMENT PRIMARY KEY,
    ten_vung VARCHAR(100) NOT NULL,
    mo_ta TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. BANG DAN TOC
CREATE TABLE IF NOT EXISTS DanToc (
    dantoc_id INT AUTO_INCREMENT PRIMARY KEY,
    ten_dantoc VARCHAR(100) NOT NULL,
    nhom_ngon_ngu VARCHAR(100),
    vung_id INT,
    FOREIGN KEY (vung_id) REFERENCES VungVanHoa(vung_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BANG KHU TRUNG BAY / KHO
CREATE TABLE IF NOT EXISTS KhuTrungBay (
    khu_id INT AUTO_INCREMENT PRIMARY KEY,
    ten_khu VARCHAR(100) NOT NULL,
    loai_khu ENUM('KHO_BAO_QUAN', 'TRUNG_BAY_INDOOR', 'TRUNG_BAY_OUTDOOR') NOT NULL DEFAULT 'TRUNG_BAY_INDOOR',
    vi_tri VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BANG HIEN VAT
CREATE TABLE IF NOT EXISTS HienVat (
    hienvat_id INT AUTO_INCREMENT PRIMARY KEY,
    ma_hienvat VARCHAR(50) NOT NULL UNIQUE,
    ten_hienvat VARCHAR(200) NOT NULL,
    hinh_anh VARCHAR(255),
    nien_dai VARCHAR(100),
    chat_lieu VARCHAR(100),
    kich_thuoc VARCHAR(100),
    tinh_trang VARCHAR(100) DEFAULT 'Nguyên vẹn',
    y_nghia_van_hoa TEXT,
    dantoc_id INT,
    khu_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dantoc_id) REFERENCES DanToc(dantoc_id) ON DELETE SET NULL,
    FOREIGN KEY (khu_id) REFERENCES KhuTrungBay(khu_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BANG LICH SU MUON TRA
CREATE TABLE IF NOT EXISTS LichSuMuonTra (
    muontra_id INT AUTO_INCREMENT PRIMARY KEY,
    hienvat_id INT NOT NULL,
    ngay_muon DATE NOT NULL,
    ngay_tra_du_kien DATE,
    ngay_tra_thuc_te DATE,
    don_vi_muon VARCHAR(255),
    muc_dich TEXT,
    trang_thai ENUM('DANG_MUON', 'DA_TRA') DEFAULT 'DANG_MUON',
    FOREIGN KEY (hienvat_id) REFERENCES HienVat(hienvat_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. BANG LICH SU BAO QUAN
CREATE TABLE IF NOT EXISTS LichSuBaoQuan (
    baoquan_id INT AUTO_INCREMENT PRIMARY KEY,
    hienvat_id INT NOT NULL,
    ngay_kiem_tra DATE NOT NULL,
    mo_ta_tinh_trang TEXT,
    bien_phap_khac_phuc TEXT,
    nguoi_thuc_hien VARCHAR(100),
    FOREIGN KEY (hienvat_id) REFERENCES HienVat(hienvat_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. BANG LOAI VE
CREATE TABLE IF NOT EXISTS LoaiVe (
    loaive_id INT AUTO_INCREMENT PRIMARY KEY,
    ten_loaive VARCHAR(100) NOT NULL,
    gia_ve DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    ghi_chu TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. BANG VE THAM QUAN
CREATE TABLE IF NOT EXISTS VeThamQuan (
    ve_id INT AUTO_INCREMENT PRIMARY KEY,
    ma_qr VARCHAR(255) NOT NULL UNIQUE,
    loaive_id INT NOT NULL,
    user_id INT,
    ngay_mua DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_su_dung DATE NOT NULL,
    trang_thai ENUM('CHUA_SU_DUNG', 'DA_SOAT_VE', 'HUY') DEFAULT 'CHUA_SU_DUNG',
    FOREIGN KEY (loaive_id) REFERENCES LoaiVe(loaive_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DULIEU MAU DEMO (SEED DATA)
INSERT INTO VungVanHoa (ten_vung, mo_ta) VALUES 
('Vùng Việt Bắc', 'Khu vực trưng bày di sản văn hóa các dân tộc vùng núi phía Bắc'),
('Vùng Tây Nguyên', 'Khu vực không gian văn hóa cồng chiêng và nhà Rông Tây Nguyên');

INSERT INTO DanToc (ten_dantoc, nhom_ngon_ngu, vung_id) VALUES 
('Tày', 'Tày - Thái', 1),
('Gia Rai', 'Môn - Khmer', 2);

INSERT INTO KhuTrungBay (ten_khu, loai_khu, vi_tri) VALUES 
('Phòng Trưng Bày 1', 'TRUNG_BAY_INDOOR', 'Tầng 1 - Khu A'),
('Phòng Trưng Bày 2', 'TRUNG_BAY_INDOOR', 'Tầng 1 - Khu B'),
('Phòng Trưng Bày 3', 'TRUNG_BAY_INDOOR', 'Tầng 2 - Khu A'),
('Phòng Trưng Bày 4', 'TRUNG_BAY_INDOOR', 'Tầng 2 - Khu B'),
('Phòng Trưng Bày 5', 'TRUNG_BAY_INDOOR', 'Tầng 2 - Khu C'),
('Kho Bảo Quản 1', 'KHO_BAO_QUAN', 'Tầng Hầm - Khu B');

INSERT INTO LoaiVe (ten_loaive, gia_ve, ghi_chu) VALUES 
('Vé Tham Quan Bảo Tàng', 30000.00, 'Vé vào cổng phổ thông'),
('Vé Trẻ Em Dưới 5 Tuổi', 0.00, 'Miễn phí 100% cho trẻ em dưới 5 tuổi');
