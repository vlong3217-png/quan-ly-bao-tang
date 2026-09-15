const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * GET /api/artifacts
 * Lấy danh sách hiện vật từ MySQL
 */
router.get('/', async (req, res) => {
  const { search } = req.query;

  try {
    let sql = `
      SELECT
        hienvat_id AS id,
        ma_hienvat AS code,
        ten_hienvat AS title,
        chat_lieu AS material,
        hinh_anh AS img,
        nien_dai AS era,
        tinh_trang AS status,
        y_nghia_van_hoa AS meaning
      FROM HienVat
    `;

    const params = [];

    if (search) {
      sql += `
        WHERE ten_hienvat LIKE ?
        OR ma_hienvat LIKE ?
      `;

      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY hienvat_id DESC`;

    const [rows] = await pool.query(sql, params);

    const data = rows.map(r => ({
      id: r.id,
      code: r.code,
      title: r.title,
      ethnic: 'Chưa xác định',
      region: 'Vùng núi cao phía Bắc',
      material: r.material || 'Chưa xác định',
      era: r.era || 'Chưa xác định',
      location: 'Kho Bảo Quản 1',
      status: r.status || 'Nguyên vẹn',
      img: r.img || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
      images: r.img ? [r.img] : [],
      meaning: r.meaning || 'Hồ sơ di sản.',
      audioText: ''
    }));

    return res.json({
      success: true,
      count: data.length,
      data: data
    });

  } catch (error) {
    console.error('❌ Lỗi GET /api/artifacts:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy dữ liệu hiện vật từ database!',
      error: error.message
    });
  }
});


/**
 * GET /api/artifacts/:id
 * Lấy một hiện vật theo ID hoặc mã hiện vật
 */
router.get('/:id', async (req, res) => {
  const idStr = String(req.params.id);

  try {
    const [rows] = await pool.query(
      `
      SELECT
        hienvat_id AS id,
        ma_hienvat AS code,
        ten_hienvat AS title,
        chat_lieu AS material,
        hinh_anh AS img,
        nien_dai AS era,
        tinh_trang AS status,
        y_nghia_van_hoa AS meaning
      FROM HienVat
      WHERE hienvat_id = ? OR ma_hienvat = ?
      LIMIT 1
      `,
      [idStr, idStr]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hiện vật!'
      });
    }

    const r = rows[0];

    const artifact = {
      id: r.id,
      code: r.code,
      title: r.title,
      ethnic: 'Chưa xác định',
      region: 'Vùng núi cao phía Bắc',
      material: r.material || 'Chưa xác định',
      era: r.era || 'Chưa xác định',
      location: 'Kho Bảo Quản 1',
      status: r.status || 'Nguyên vẹn',
      img: r.img || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
      images: r.img ? [r.img] : [],
      meaning: r.meaning || 'Hồ sơ di sản.',
      audioText: ''
    };

    return res.json({
      success: true,
      data: artifact
    });

  } catch (error) {
    console.error('❌ Lỗi GET /api/artifacts/:id:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy thông tin hiện vật!',
      error: error.message
    });
  }
});


/**
 * POST /api/artifacts
 * Thêm hoặc cập nhật hiện vật vào MySQL
 */
router.post('/', async (req, res) => {
  const {
    code,
    title,
    ethnic,
    region,
    material,
    location,
    status,
    img,
    images,
    meaning,
    audioText
  } = req.body;

  if (!code || !title) {
    return res.status(400).json({
      success: false,
      message: 'Mã hiện vật và tên hiện vật không được để trống!'
    });
  }

  try {
    await pool.query(
      `
        INSERT INTO HienVat
(
  ma_hienvat,
  ten_hienvat,
  chat_lieu,
  hinh_anh,
  tinh_trang,
  y_nghia_van_hoa
)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(ma_hienvat) DO UPDATE SET
  ten_hienvat = excluded.ten_hienvat,
  chat_lieu = excluded.chat_lieu,
  hinh_anh = excluded.hinh_anh,
  tinh_trang = excluded.tinh_trang,
  y_nghia_van_hoa = excluded.y_nghia_van_hoa
      `,
      [
        code,
        title,
        material || null,
        img || null,
        status || 'Nguyên vẹn',
        meaning || null
      ]
    );

    // Lấy lại dữ liệu vừa lưu từ MySQL
    const [rows] = await pool.query(
      `
      SELECT
        hienvat_id AS id,
        ma_hienvat AS code,
        ten_hienvat AS title,
        chat_lieu AS material,
        hinh_anh AS img,
        nien_dai AS era,
        tinh_trang AS status,
        y_nghia_van_hoa AS meaning
      FROM HienVat
      WHERE ma_hienvat = ?
      LIMIT 1
      `,
      [code]
    );

    if (rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Đã lưu nhưng không thể đọc lại dữ liệu từ database!'
      });
    }

    const r = rows[0];

    const savedArtifact = {
      id: r.id,
      code: r.code,
      title: r.title,
      ethnic: ethnic || 'Chưa xác định',
      region: region || 'Vùng núi cao phía Bắc',
      material: r.material || 'Chưa xác định',
      era: r.era || 'Chưa xác định',
      location: location || 'Kho Bảo Quản 1',
      status: r.status || 'Nguyên vẹn',
      img: r.img || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
      images: Array.isArray(images) && images.length > 0
        ? images
        : (r.img ? [r.img] : []),
      meaning: r.meaning || 'Hồ sơ di sản mới bổ sung.',
      audioText: audioText || `Hiện vật ${title} của Dân tộc ${ethnic || 'chưa xác định'}.`
    };

    console.log('✅ Đã lưu hiện vật vào MySQL:', savedArtifact.code);

    return res.status(201).json({
      success: true,
      message: 'Thêm mới hồ sơ hiện vật thành công!',
      data: savedArtifact
    });

  } catch (error) {
    console.error('❌ Lỗi INSERT HienVat:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lưu hiện vật vào database!',
      error: error.message
    });
  }
});


/**
 * DELETE /api/artifacts/:id
 * Xóa hiện vật khỏi MySQL
 */
router.delete('/:id', async (req, res) => {
  const idStr = String(req.params.id);

  try {
    const [result] = await pool.query(
      `
      DELETE FROM HienVat
      WHERE hienvat_id = ? OR ma_hienvat = ?
      `,
      [idStr, idStr]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hiện vật để xóa!'
      });
    }

    console.log('🗑️ Đã xóa hiện vật:', idStr);

    return res.json({
      success: true,
      message: 'Xóa hồ sơ hiện vật thành công!'
    });

  } catch (error) {
    console.error('❌ Lỗi DELETE HienVat:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể xóa hiện vật khỏi database!',
      error: error.message
    });
  }
});


module.exports = router;