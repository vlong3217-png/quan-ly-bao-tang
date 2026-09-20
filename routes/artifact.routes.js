const express = require('express');
const router = express.Router();
const pool = require('../config/db');

function detectEthnicFromTitle(title, fallback = 'Chưa xác định') {
  if (!title) return fallback;
  const ethnicKeywords = [
    'Sán Dìu', 'Sán Chay', 'Kinh', 'Tày', 'Thái', 'Hoa', 'Mường',
    'H\'Mông', 'Hmong', 'H Mông', 'Dao', 'Gia Rai', 'Ê Đê', 'Ba Na', 'Chăm',
    'Xơ Đăng', 'Cơ Ho', 'Chơ Ro', 'Nùng', 'Hre', 'Khơ Me', 'Khmer', 'M\'Nông',
    'Raglai', 'Xtiêng', 'Bru', 'Vân Kiều', 'Giáy', 'Cơ Tu', 'Giẻ Triêng', 'Ta Ôi',
    'Mạ', 'Co', 'Thổ', 'Khơ Mú', 'Xinh Mun', 'Chu Ru'
  ];

  for (const eth of ethnicKeywords) {
    if (title.toLowerCase().includes(eth.toLowerCase())) {
      return eth.startsWith('Dân tộc') ? eth : `Dân tộc ${eth}`;
    }
  }
  return fallback;
}

/**
 * GET /api/artifacts
 * Lấy danh sách hiện vật từ SQLite
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
        y_nghia_van_hoa AS meaning,
        dan_toc AS ethnic,
        vung_van_hoa AS region,
        vi_tri_kho AS location
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

    const data = rows.map(r => {
      const resolvedEthnic = (r.ethnic && r.ethnic !== 'Chưa xác định')
        ? r.ethnic
        : detectEthnicFromTitle(r.title, 'Chưa xác định');

      return {
        id: r.id,
        code: r.code,
        title: r.title,
        ethnic: resolvedEthnic,
        region: r.region || 'Vùng núi cao phía Bắc',
        material: r.material || 'Chưa xác định',
        era: r.era || 'Thế kỷ XX',
        location: r.location || 'Kho Bảo Quản 1',
        status: r.status || 'Nguyên vẹn',
        img: r.img || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
        images: r.img ? [r.img] : [],
        meaning: r.meaning || 'Hồ sơ di sản.',
        audioText: `Hiện vật ${r.title} của Dân tộc ${resolvedEthnic}.`
      };
    });

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
        y_nghia_van_hoa AS meaning,
        dan_toc AS ethnic,
        vung_van_hoa AS region,
        vi_tri_kho AS location
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
    const resolvedEthnic = (r.ethnic && r.ethnic !== 'Chưa xác định')
      ? r.ethnic
      : detectEthnicFromTitle(r.title, 'Chưa xác định');

    const artifact = {
      id: r.id,
      code: r.code,
      title: r.title,
      ethnic: resolvedEthnic,
      region: r.region || 'Vùng núi cao phía Bắc',
      material: r.material || 'Chưa xác định',
      era: r.era || 'Thế kỷ XX',
      location: r.location || 'Kho Bảo Quản 1',
      status: r.status || 'Nguyên vẹn',
      img: r.img || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
      images: r.img ? [r.img] : [],
      meaning: r.meaning || 'Hồ sơ di sản.',
      audioText: `Hiện vật ${r.title} của Dân tộc ${resolvedEthnic}.`
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
 * Thêm hoặc cập nhật hiện vật vào Database
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

  const finalEthnic = (ethnic && ethnic !== 'Chưa xác định')
    ? ethnic
    : detectEthnicFromTitle(title, 'Chưa xác định');
  const finalRegion = region || 'Vùng núi cao phía Bắc';
  const finalLocation = location || 'Kho Bảo Quản 1';

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
  y_nghia_van_hoa,
  dan_toc,
  vung_van_hoa,
  vi_tri_kho
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(ma_hienvat) DO UPDATE SET
  ten_hienvat = excluded.ten_hienvat,
  chat_lieu = excluded.chat_lieu,
  hinh_anh = excluded.hinh_anh,
  tinh_trang = excluded.tinh_trang,
  y_nghia_van_hoa = excluded.y_nghia_van_hoa,
  dan_toc = excluded.dan_toc,
  vung_van_hoa = excluded.vung_van_hoa,
  vi_tri_kho = excluded.vi_tri_kho
      `,
      [
        code,
        title,
        material || null,
        img || null,
        status || 'Nguyên vẹn',
        meaning || null,
        finalEthnic,
        finalRegion,
        finalLocation
      ]
    );

    // Lấy lại dữ liệu vừa lưu từ Database
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
        y_nghia_van_hoa AS meaning,
        dan_toc AS ethnic,
        vung_van_hoa AS region,
        vi_tri_kho AS location
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
      ethnic: r.ethnic || finalEthnic,
      region: r.region || finalRegion,
      material: r.material || 'Chưa xác định',
      era: r.era || 'Thế kỷ XX',
      location: r.location || finalLocation,
      status: r.status || 'Nguyên vẹn',
      img: r.img || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
      images: Array.isArray(images) && images.length > 0
        ? images
        : (r.img ? [r.img] : []),
      meaning: r.meaning || 'Hồ sơ di sản mới bổ sung.',
      audioText: audioText || `Hiện vật ${title} của Dân tộc ${r.ethnic || finalEthnic}.`
    };

    console.log('✅ Đã lưu hiện vật vào SQLite:', savedArtifact.code);

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