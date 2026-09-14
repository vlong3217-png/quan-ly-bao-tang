const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middlewares/auth');

// Heritage Artifacts Database
let MOCK_ARTIFACTS = [];

/**
 * GET /api/artifacts
 * Query artifacts catalog with optional search & filter
 */
router.get('/', async (req, res) => {
  const { search, region, ethnic } = req.query;

  try {
    let results = MOCK_ARTIFACTS;

    try {
      const [rows] = await pool.query(`
        SELECT 
          hienvat_id as id,
          ma_hienvat as code,
          ten_hienvat as title,
          chat_lieu as material,
          hinh_anh as img,
          nien_dai as era,
          tinh_trang as status,
          y_nghia_van_hoa as meaning
        FROM HienVat
        ORDER BY hienvat_id DESC
      `);
      if (rows.length > 0) {
        results = rows.map(r => ({
          ...r,
          ethnic: r.ethnic || 'Chưa xác định',
          region: r.region || 'Vùng núi cao phía Bắc',
          location: r.location || 'Kho Bảo Quản 1',
          img: r.img || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80'
        }));
      }
    } catch (err) {}

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(art => (art.title && art.title.toLowerCase().includes(q)) || (art.code && art.code.toLowerCase().includes(q)));
    }

    return res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/artifacts/:id
 */
router.get('/:id', (req, res) => {
  const idStr = String(req.params.id);
  const art = MOCK_ARTIFACTS.find(item => String(item.id) === idStr || item.code === idStr);
  if (!art) return res.status(404).json({ success: false, message: 'Không tìm thấy hiện vật!' });
  return res.json({ success: true, data: art });
});

/**
 * POST /api/artifacts (Staff inventory addition)
 */
router.post('/', async (req, res) => {
  const { id, code, title, ethnic, region, material, location, status, img, images, meaning, audioText } = req.body;

  const newArt = {
    id: id || Date.now(),
    code: code || `HV-${String(MOCK_ARTIFACTS.length + 1).padStart(3, '0')}`,
    title: title || 'Hiện vật mới',
    ethnic: ethnic || 'Chưa xác định',
    region: region || 'Vùng núi cao phía Bắc',
    material: material || 'Chưa xác định',
    era: 'Thế kỷ XX',
    location: location || 'Kho Bảo Quản 1',
    status: status || 'Nguyên vẹn',
    img: img || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
    images: Array.isArray(images) && images.length > 0 ? images : [img],
    meaning: meaning || 'Hồ sơ di sản mới bổ sung.',
    audioText: audioText || `Hiện vật ${title} của Dân tộc ${ethnic}.`
  };

  try {
    await pool.query(
      'INSERT INTO HienVat (ma_hienvat, ten_hienvat, chat_lieu, hinh_anh, tinh_trang, y_nghia_van_hoa) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ten_hienvat = VALUES(ten_hienvat), chat_lieu = VALUES(chat_lieu), hinh_anh = VALUES(hinh_anh)',
      [newArt.code, newArt.title, newArt.material, newArt.img, newArt.status, newArt.meaning]
    );
  } catch (err) {}

  const existingIdx = MOCK_ARTIFACTS.findIndex(a => String(a.id) === String(newArt.id) || a.code === newArt.code);
  if (existingIdx !== -1) {
    MOCK_ARTIFACTS[existingIdx] = newArt;
  } else {
    MOCK_ARTIFACTS.unshift(newArt);
  }

  return res.status(201).json({ success: true, message: 'Thêm mới hồ sơ hiện vật kho thành công!', data: newArt });
});

/**
 * DELETE /api/artifacts/:id (Staff inventory artifact deletion)
 */
router.delete('/:id', async (req, res) => {
  const idStr = String(req.params.id);
  MOCK_ARTIFACTS = MOCK_ARTIFACTS.filter(item => String(item.id) !== idStr && item.code !== idStr);

  try {
    await pool.query('DELETE FROM HienVat WHERE hienvat_id = ? OR ma_hienvat = ?', [idStr, idStr]);
  } catch (err) {}

  return res.json({ success: true, message: 'Xóa hồ sơ hiện vật thành công!' });
});

module.exports = router;
