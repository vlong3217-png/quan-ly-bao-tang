const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middlewares/auth');
const pool = require('../config/db');

/* =========================================================
   VÉ THAM QUAN
   ========================================================= */

/**
 * POST /api/tickets/book
 * Đặt vé tham quan trực tuyến
 */
router.post('/book', async (req, res) => {
  try {
    const {
      name,
      phone,
      date,
      slot,
      adultQty,
      studentQty,
      childQty,
      foreignerQty,
      paymentMethod
    } = req.body;

    const adult = parseInt(adultQty) || 0;
    const student = parseInt(studentQty) || 0;
    const child = parseInt(childQty) || 0;
    const foreigner = parseInt(foreignerQty) || 0;

    const totalAmount =
      adult * 30000 +
      student * 15000 +
      foreigner * 50000;

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const ticketCode = `VE-2026-${randomNum}`;
    const qrCodeData = `BAOTANG-#${ticketCode}-${phone || ''}`;

    const qrUrl =
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeData)}`;

    // Lấy loại vé mặc định
    const [loaiVeRows] = await pool.query(`
      SELECT loaive_id
      FROM LoaiVe
      ORDER BY loaive_id
      LIMIT 1
    `);

    if (!loaiVeRows.length) {
      return res.status(500).json({
        success: false,
        message: 'Chưa có loại vé trong cơ sở dữ liệu!'
      });
    }

    const loaiveId = loaiVeRows[0].loaive_id;

    await pool.query(`
      INSERT INTO VeThamQuan
      (
        ma_qr,
        loaive_id,
        ten_khach,
        so_dien_thoai,
        ngay_tham_quan,
        khung_gio,
        so_nguoi_lon,
        so_sinh_vien,
        so_tre_em,
        so_nguoi_nuoc_ngoai,
        tong_tien,
        phuong_thuc_thanh_toan,
        trang_thai
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `#${ticketCode}`,
      loaiveId,
      name || 'Khách Đặt Vé',
      phone || '',
      date || null,
      slot || 'Sáng (08:00 - 11:30)',
      adult,
      student,
      child,
      foreigner,
      totalAmount,
      paymentMethod || 'QR_BANK',
      'CHUA_SU_DUNG'
    ]);

    const [rows] = await pool.query(`
      SELECT *
      FROM VeThamQuan
      WHERE ma_qr = ?
      LIMIT 1
    `, [`#${ticketCode}`]);

    const ticket = rows[0];

    return res.status(201).json({
      success: true,
      message: 'Đặt vé tham quan trực tuyến thành công!',
      data: {
        id: ticket.ve_id,
        ticketCode: ticket.ma_qr,
        name: ticket.ten_khach,
        phone: ticket.so_dien_thoai,
        date: ticket.ngay_tham_quan,
        slot: ticket.khung_gio,
        adultQty: ticket.so_nguoi_lon,
        studentQty: ticket.so_sinh_vien,
        childQty: ticket.so_tre_em,
        foreignerQty: ticket.so_nguoi_nuoc_ngoai,
        totalAmount: ticket.tong_tien,
        paymentMethod: ticket.phuong_thuc_thanh_toan,
        qrUrl: qrUrl,
        status: ticket.trang_thai,
        createdAt: ticket.ngay_mua
      }
    });

  } catch (error) {
    console.error('❌ Lỗi đặt vé:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lưu vé vào cơ sở dữ liệu!',
      error: error.message
    });
  }
});


/**
 * POST /api/tickets/scan
 * Soát vé
 */
router.post(
  '/scan',
  verifyToken,
  authorizeRoles('BANVE', 'ADMIN'),
  async (req, res) => {
    try {
      const { qrCode } = req.body;

      if (!qrCode) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp mã QR Code soát vé!'
        });
      }

      const [rows] = await pool.query(`
        SELECT *
        FROM VeThamQuan
        WHERE ma_qr = ?
           OR ma_qr LIKE ?
        LIMIT 1
      `, [
        qrCode,
        `%${qrCode}%`
      ]);

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy vé trong hệ thống!'
        });
      }

      const ticket = rows[0];

      if (ticket.trang_thai === 'DA_SOAT_VE') {
        return res.status(400).json({
          success: false,
          message: `VÉ ĐÃ SỬ DỤNG LÚC ${ticket.used_at || 'trước đó'}! Không hợp lệ.`,
          data: ticket
        });
      }

      if (ticket.trang_thai === 'HUY') {
        return res.status(400).json({
          success: false,
          message: 'Vé đã bị hủy!',
          data: ticket
        });
      }

      const usedAt = new Date().toISOString();

      await pool.query(`
        UPDATE VeThamQuan
        SET trang_thai = ?,
            used_at = ?
        WHERE ve_id = ?
      `, [
        'DA_SOAT_VE',
        usedAt,
        ticket.ve_id
      ]);

      const [updatedRows] = await pool.query(`
        SELECT *
        FROM VeThamQuan
        WHERE ve_id = ?
        LIMIT 1
      `, [ticket.ve_id]);

      return res.json({
        success: true,
        message: `VÉ HỢP LỆ! Đã xác thực lượt vào cửa cho ${ticket.ten_khach}.`,
        data: updatedRows[0]
      });

    } catch (error) {
      console.error('❌ Lỗi soát vé:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể kiểm tra vé!',
        error: error.message
      });
    }
  }
);


/**
 * GET /api/tickets
 * Lấy toàn bộ vé
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT *
      FROM VeThamQuan
      ORDER BY ve_id DESC
    `);

    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {
    console.error('❌ Lỗi lấy danh sách vé:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách vé!',
      error: error.message
    });
  }
});


/* =========================================================
   LỊCH ĐOÀN THAM QUAN
   ========================================================= */

/**
 * GET /api/tickets/tours
 */
router.get('/tours', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT *
      FROM LichDoan
      ORDER BY id DESC
    `);

    const data = rows.map(tour => ({
      id: tour.id,
      code: tour.code,
      name: tour.name,
      ward: tour.ward || '',
      province: tour.province || '',
      target: tour.target || 'Du khách',
      size: tour.size || '',
      time: tour.time || '',
      guide: tour.guide || 'Cán bộ trực',
      status: tour.status || 'Chờ Đón Tiếp',
      createdAt: tour.created_at,
      updatedAt: tour.updated_at
    }));

    return res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi lấy lịch đoàn:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy lịch đoàn!',
      error: error.message
    });
  }
});


/**
 * POST /api/tickets/tours
 */
router.post('/tours', async (req, res) => {
  try {
    const {
      id,
      code,
      name,
      ward,
      province,
      target,
      size,
      time,
      guide,
      status
    } = req.body;

    const tourCode =
      code || `#DOAN-${Math.floor(100 + Math.random() * 900)}`;

    const tourName =
      name || 'Đoàn tham quan';

    const tour = {
      code: tourCode,
      name: tourName,
      ward: ward || '',
      province: province || '',
      target: target || 'Du khách',
      size: size || '50 Khách',
      time: time || 'Hôm nay',
      guide: guide || 'Cán bộ trực',
      status: status || 'Chờ Đón Tiếp'
    };

    /*
     * Nếu có id → cập nhật bản ghi đó.
     * Nếu không có id → kiểm tra code.
     */
    if (id) {
      const [existing] = await pool.query(`
        SELECT id
        FROM LichDoan
        WHERE id = ?
        LIMIT 1
      `, [id]);

      if (existing.length) {
        await pool.query(`
          UPDATE LichDoan
          SET code = ?,
              name = ?,
              ward = ?,
              province = ?,
              target = ?,
              size = ?,
              time = ?,
              guide = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          tour.code,
          tour.name,
          tour.ward,
          tour.province,
          tour.target,
          tour.size,
          tour.time,
          tour.guide,
          tour.status,
          id
        ]);

        const [rows] = await pool.query(`
          SELECT *
          FROM LichDoan
          WHERE id = ?
        `, [id]);

        return res.json({
          success: true,
          message: 'Cập nhật lịch đoàn thành công!',
          data: rows[0]
        });
      }
    }

    /*
     * Nếu code đã tồn tại → cập nhật
     */
    const [existingCode] = await pool.query(`
      SELECT id
      FROM LichDoan
      WHERE code = ?
      LIMIT 1
    `, [tour.code]);

    if (existingCode.length) {
      const existingId = existingCode[0].id;

      await pool.query(`
        UPDATE LichDoan
        SET name = ?,
            ward = ?,
            province = ?,
            target = ?,
            size = ?,
            time = ?,
            guide = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        tour.name,
        tour.ward,
        tour.province,
        tour.target,
        tour.size,
        tour.time,
        tour.guide,
        tour.status,
        existingId
      ]);

      const [rows] = await pool.query(`
        SELECT *
        FROM LichDoan
        WHERE id = ?
      `, [existingId]);

      return res.json({
        success: true,
        message: 'Cập nhật lịch đoàn thành công!',
        data: rows[0]
      });
    }

    /*
     * Không tồn tại → tạo mới
     */
    const [result] = await pool.query(`
      INSERT INTO LichDoan
      (
        code,
        name,
        ward,
        province,
        target,
        size,
        time,
        guide,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tour.code,
      tour.name,
      tour.ward,
      tour.province,
      tour.target,
      tour.size,
      tour.time,
      tour.guide,
      tour.status
    ]);

    const [rows] = await pool.query(`
      SELECT *
      FROM LichDoan
      WHERE id = ?
    `, [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Lưu lịch đoàn thành công!',
      data: rows[0]
    });

  } catch (error) {
    console.error('❌ Lỗi lưu lịch đoàn:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lưu lịch đoàn!',
      error: error.message
    });
  }
});


/**
 * DELETE /api/tickets/tours/:id
 */
router.delete('/tours/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const [result] = await pool.query(`
      DELETE FROM LichDoan
      WHERE id = ?
         OR code = ?
    `, [id, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch đoàn cần xóa!'
      });
    }

    return res.json({
      success: true,
      message: 'Xóa lịch đoàn thành công!'
    });

  } catch (error) {
    console.error('❌ Lỗi xóa lịch đoàn:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể xóa lịch đoàn!',
      error: error.message
    });
  }
});


/* =========================================================
   MƯỢN / TRẢ HIỆN VẬT
   ========================================================= */

/**
 * GET /api/tickets/borrows
 */
router.get('/borrows', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        mt.muontra_id AS id,
        mt.hienvat_id,
        hv.ma_hienvat AS artifactCode,
        hv.ten_hienvat AS artifactName,
        mt.ngay_muon,
        mt.ngay_tra_du_kien,
        mt.ngay_tra_thuc_te,
        mt.don_vi_muon,
        mt.muc_dich,
        mt.trang_thai
      FROM LichSuMuonTra mt
      LEFT JOIN HienVat hv
        ON mt.hienvat_id = hv.hienvat_id
      ORDER BY mt.muontra_id DESC
    `);

    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {
    console.error('❌ Lỗi lấy lịch sử mượn trả:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy lịch sử mượn trả!',
      error: error.message
    });
  }
});


/**
 * POST /api/tickets/borrows
 */
router.post('/borrows', async (req, res) => {
  try {
    const item = req.body;

    const rawArtifact =
      item.hienvat_id ||
      item.hienvatId ||
      item.artifactId ||
      item.artifact;

    let hienvatId = null;

    if (rawArtifact) {
      const [hvRows] = await pool.query(`
        SELECT hienvat_id
        FROM HienVat
        WHERE hienvat_id = ?
           OR ma_hienvat = ?
           OR ten_hienvat = ?
           OR ten_hienvat LIKE ?
        LIMIT 1
      `, [rawArtifact, rawArtifact, rawArtifact, `%${rawArtifact}%`]);

      if (hvRows.length) {
        hienvatId = hvRows[0].hienvat_id;
      }
    }

    if (!hienvatId) {
      const [firstHv] = await pool.query(`SELECT hienvat_id FROM HienVat LIMIT 1`);
      if (firstHv.length) {
        hienvatId = firstHv[0].hienvat_id;
      } else {
        const [insertedHv] = await pool.query(`
          INSERT INTO HienVat (ma_hienvat, ten_hienvat)
          VALUES (?, ?)
        `, [`HV-${Date.now()}`, rawArtifact || 'Hiện vật di sản']);
        hienvatId = insertedHv.insertId;
      }
    }

    /*
     * Có id → cập nhật
     */
    if (item.id) {
      const [existing] = await pool.query(`
        SELECT muontra_id, hienvat_id
        FROM LichSuMuonTra
        WHERE muontra_id = ?
        LIMIT 1
      `, [item.id]);

      if (existing.length) {
        const targetHienVatId = hienvatId || existing[0].hienvat_id;

        await pool.query(`
          UPDATE LichSuMuonTra
          SET hienvat_id = ?,
              ngay_muon = COALESCE(?, ngay_muon),
              ngay_tra_du_kien = COALESCE(?, ngay_tra_du_kien),
              ngay_tra_thuc_te = COALESCE(?, ngay_tra_thuc_te),
              don_vi_muon = COALESCE(?, don_vi_muon),
              muc_dich = COALESCE(?, muc_dich),
              trang_thai = COALESCE(?, trang_thai)
          WHERE muontra_id = ?
        `, [
          targetHienVatId,
          item.ngay_muon || item.borrowDate || null,
          item.ngay_tra_du_kien || item.expectedReturnDate || item.returnDate || null,
          item.ngay_tra_thuc_te || item.actualReturnDate || null,
          item.don_vi_muon || item.borrower || null,
          item.muc_dich || item.purpose || null,
          item.trang_thai || item.status || null,
          item.id
        ]);

        const [rows] = await pool.query(`
          SELECT
            mt.muontra_id AS id,
            mt.hienvat_id,
            hv.ma_hienvat AS artifactCode,
            COALESCE(hv.ten_hienvat, 'Hiện vật di sản') AS artifactName,
            mt.ngay_muon,
            mt.ngay_tra_du_kien,
            mt.ngay_tra_thuc_te,
            mt.don_vi_muon,
            mt.muc_dich,
            mt.trang_thai
          FROM LichSuMuonTra mt
          LEFT JOIN HienVat hv ON mt.hienvat_id = hv.hienvat_id
          WHERE mt.muontra_id = ?
        `, [item.id]);

        return res.json({
          success: true,
          message: 'Cập nhật phiếu mượn trả thành công!',
          data: rows[0]
        });
      }
    }

    /*
     * Tạo phiếu mới
     */
    const [result] = await pool.query(`
      INSERT INTO LichSuMuonTra
      (
        hienvat_id,
        ngay_muon,
        ngay_tra_du_kien,
        ngay_tra_thuc_te,
        don_vi_muon,
        muc_dich,
        trang_thai
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      hienvatId,
      item.ngay_muon || item.borrowDate || new Date().toISOString().slice(0, 10),
      item.ngay_tra_du_kien || item.expectedReturnDate || item.returnDate || null,
      item.ngay_tra_thuc_te || item.actualReturnDate || null,
      item.don_vi_muon || item.borrower || 'Đơn vị triển lãm',
      item.muc_dich || item.purpose || 'Mượn triển lãm',
      item.trang_thai || item.status || 'DANG_MUON'
    ]);

    const [rows] = await pool.query(`
      SELECT
        mt.muontra_id AS id,
        mt.hienvat_id,
        hv.ma_hienvat AS artifactCode,
        COALESCE(hv.ten_hienvat, 'Hiện vật di sản') AS artifactName,
        mt.ngay_muon,
        mt.ngay_tra_du_kien,
        mt.ngay_tra_thuc_te,
        mt.don_vi_muon,
        mt.muc_dich,
        mt.trang_thai
      FROM LichSuMuonTra mt
      LEFT JOIN HienVat hv ON mt.hienvat_id = hv.hienvat_id
      WHERE mt.muontra_id = ?
    `, [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Lưu phiếu mượn trả thành công!',
      data: rows[0]
    });

  } catch (error) {
    console.error('❌ Lỗi lưu mượn trả:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lưu phiếu mượn trả!',
      error: error.message
    });
  }
});


/**
 * DELETE /api/tickets/borrows/:id
 */
router.delete('/borrows/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const [result] = await pool.query(`
      DELETE FROM LichSuMuonTra
      WHERE muontra_id = ?
    `, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phiếu mượn trả!'
      });
    }

    return res.json({
      success: true,
      message: 'Xóa phiếu mượn trả thành công!'
    });

  } catch (error) {
    console.error('❌ Lỗi xóa phiếu mượn trả:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể xóa phiếu mượn trả!',
      error: error.message
    });
  }
});


module.exports = router;