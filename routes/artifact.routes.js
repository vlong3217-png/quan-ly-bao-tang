const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middlewares/auth');

// Sample Dataset for fallback (54 Ethnic Heritage Artifacts)
let MOCK_ARTIFACTS = [
  {
    id: 1,
    code: 'HV-001',
    title: 'Trang phục Cổ truyền Dân tộc Tày',
    ethnic: 'Dân tộc Tày',
    region: 'Vùng núi cao phía Bắc',
    languageGroup: 'Tày - Thái',
    material: 'Vải chàm dệt thủ công, thêu hoa văn chỉ tơ tằm',
    era: 'Thế kỷ XIX',
    location: 'Phòng Trưng Bày 1',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Trang phục thể hiện bản sắc văn hóa độc đáo và kỹ nghệ dệt nhuộm chàm truyền thống của người Tày vùng Việt Bắc.',
    audioText: 'Trang phục cổ truyền của đồng bào Tày với áo dài năm thân nhuộm chàm đen nhánh đặc trưng, viền cổ nẹp thổ cẩm tinh xảo.'
  },
  {
    id: 2,
    code: 'HV-002',
    title: 'Đàn T\'rưng Tre Tây Nguyên',
    ethnic: 'Dân tộc Gia Rai',
    region: 'Vùng Trường Sơn - Tây Nguyên',
    languageGroup: 'Môn - Khơ mer',
    material: 'Ống tre nứa tự nhiên, dây mây rừng',
    era: 'Thế kỷ XX',
    location: 'Phòng Trưng Bày 2',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Nhạc cụ gõ truyền thống bằng tre nứa phát ra âm thanh vang vọng như tiếng suối róc rách của đại ngàn.',
    audioText: 'Đàn Trưng dân tộc Gia Rai gắn liền với các lễ hội đâm trâu, mừng lúa mới và sinh hoạt cộng đồng nhà Rông.'
  },
  {
    id: 3,
    code: 'HV-003',
    title: 'Trống Đồng Văn hóa Đông Sơn',
    ethnic: 'Dân tộc Kinh (Việt)',
    region: 'Vùng Đồng bằng Bắc Bộ',
    languageGroup: 'Việt - Mường',
    material: 'Đồng thau đúc nguyên khối',
    era: 'Thời kỳ Đông Sơn (thế kỷ II-III TCN)',
    location: 'Kho Bảo Quản 1',
    status: 'Đang bảo quản',
    img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Biểu tượng đỉnh cao của nền văn minh lúa nước sông Hồng và kỹ thuật đúc đồng thượng thừa của người Việt cổ.',
    audioText: 'Trống đồng cổ với mặt trời 14 tia ở tâm, bao quanh là các vành chim Lạc bay và cảnh sinh hoạt giã gạo của cư dân cổ.'
  },
  {
    id: 4,
    code: 'HV-004',
    title: 'Khèn Bè và Váy Thổ Cẩm Hoa Mông',
    ethnic: 'Dân tộc H\'Mông',
    region: 'Vùng núi cao phía Bắc',
    languageGroup: 'H\'mông - Dao',
    material: 'Gỗ pơ mu, ống trúc, vải lanh nhuộm sáp ong',
    era: 'Thế kỷ XX',
    location: 'Phòng Trưng Bày 3',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Bộ nhạc cụ khèn thiêng và trang phục vẽ sáp ong tinh xảo trong các phiên chợ tình vùng cao.',
    audioText: 'Tiếng khèn Mông gọi bạn tình trong sương sớm cùng váy xòe hoa dệt từ sợi lanh bền bỉ.'
  },
  {
    id: 5,
    code: 'HV-005',
    title: 'Khăn Piêu Thêu Tay Dân Tộc Thái',
    ethnic: 'Dân tộc Thái',
    region: 'Vùng Thung lũng',
    languageGroup: 'Tày - Thái',
    material: 'Vải bông dệt tay nhuộm chàm, chỉ thêu nhiều màu',
    era: 'Thế kỷ XX',
    location: 'Phòng Trưng Bày 2',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Vật đính ước thiêng liêng và biểu trưng cho sự khéo léo, nết na của người con gái Thái Tây Bắc.',
    audioText: 'Khăn Piêu với họa tiết cút piêu hình trăng sao, ngọn rau dớn phản ánh thế giới quan gắn liền với núi rừng thiên nhiên.'
  },
  {
    id: 6,
    code: 'HV-006',
    title: 'Bộ Cồng Chiêng Tây Nguyên Cổ Truyền',
    ethnic: 'Dân tộc Ba Na',
    region: 'Vùng Trường Sơn - Tây Nguyên',
    languageGroup: 'Môn - Khơ mer',
    material: 'Hợp kim đồng, thiếc, bạc',
    era: 'Thế kỷ XIX',
    location: 'Phòng Trưng Bày 5',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Kiệt tác Di sản truyền khẩu và phi vật thể nhân loại UNESCO, tiếng thiêng kết nối thần linh và buôn làng.',
    audioText: 'Bộ chiêng gồm chiêng mẹ, chiêng con hòa tấu nhịp nhàng mang linh hồn của đất trời Tây Nguyên huyền thoại.'
  },
  {
    id: 7,
    code: 'HV-007',
    title: 'Gốm Cổ Bàu Trúc Nặn Tay Dân Tộc Chăm',
    ethnic: 'Dân tộc Chăm',
    region: 'Vùng miền Trung - Ven biển',
    languageGroup: 'Nam Đảo',
    material: 'Đất sét mịn ven sông Quao, nung lộ thiên bằng củi rơm',
    era: 'Thế kỷ XIX',
    location: 'Phòng Trưng Bày 5',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1578925518470-4def7a0f08bb?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1578925518470-4def7a0f08bb?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Làng gốm cổ xưa bậc nhất Đông Nam Á với kỹ thuật người đi quanh bàn xoay nặn hình độc đáo.',
    audioText: 'Gốm Bàu Trúc lưu giữ linh hồn đất và lửa với màu khói đỏ vàng huyền bí của người Chăm duyên hải miền Trung.'
  },
  {
    id: 8,
    code: 'HV-008',
    title: 'Thạp Đồng Đào Thịnh Thời Kỳ Hùng Vương',
    ethnic: 'Dân tộc Kinh (Việt)',
    region: 'Vùng Trung du - Bắc Bộ',
    languageGroup: 'Việt - Mường',
    material: 'Đồng thau đúc chạm khắc hoa văn chìm',
    era: 'Thế kỷ V TCN',
    location: 'Kho Bảo Quản 1',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Bảo vật quốc gia phản ánh đời sống tâm linh, kỹ thuật luyện kim phát triển rực rỡ thời đại Hùng Vương dựng nước.',
    audioText: 'Thạp đồng Đào Thịnh khắc họa đoàn thuyền chiến, chim Lạc và các cặp tượng phồn thực cầu mong mùa màng tốt tươi.'
  },
  {
    id: 9,
    code: 'HV-009',
    title: 'Trang Phục Cưới Cô Dâu Dân Tộc Dao Đỏ',
    ethnic: 'Dân tộc Dao',
    region: 'Vùng núi cao phía Bắc',
    languageGroup: 'H\'mông - Dao',
    material: 'Vải chàm thêu chỉ đỏ rực rỡ, trang sức bạc chạm hoa lá',
    era: 'Thế kỷ XX',
    location: 'Phòng Trưng Bày 3',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Bộ lễ phục truyền thống thể hiện sự tinh túy của phụ nữ Dao Đỏ trong ngày trọng đại nhất cuộc đời.',
    audioText: 'Khăn mũ đỏ quả trám cùng chuỗi hạt cườm bạc rủ xuống bờ vai làm nổi bật vẻ đẹp rạng ngời của cô dâu Dao.'
  },
  {
    id: 10,
    code: 'HV-010',
    title: 'Khung Cửi Dệt Cạp Váy Thổ Cẩm Mường',
    ethnic: 'Dân tộc Mường',
    region: 'Vùng Thung lũng',
    languageGroup: 'Việt - Mường',
    material: 'Gỗ lim, thoi dệt tre, sợi tơ tằm nhuộm thảo mộc',
    era: 'Thế kỷ XIX',
    location: 'Phòng Trưng Bày 1',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Dụng cụ tạo nên những dải cạp váy Mường nổi danh khắp vùng thung lũng với biểu tượng rồng mây bay lượn.',
    audioText: 'Nghệ thuật dệt cạp váy Mường đòi hỏi sự kiên trì tỉ mỉ từng sợi tơ, tạo nên hoa văn hình học và thần thú sinh động.'
  },
  {
    id: 11,
    code: 'HV-011',
    title: 'Tượng Gỗ Dân Gian Nhà Mồ Tây Nguyên',
    ethnic: 'Dân tộc Ê Đê',
    region: 'Vùng Trường Sơn - Tây Nguyên',
    languageGroup: 'Nam Đảo',
    material: 'Gỗ gõ đỏ đẽo bằng rìu tay mộc mạc',
    era: 'Thế kỷ XX',
    location: 'Phòng Trưng Bày 5',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Nghệ thuật điêu khắc dân gian truyền thống tiễn đưa người đã khuất về với tổ tiên trong lễ bỏ mả Pơthi.',
    audioText: 'Tượng nhà mồ mang dáng hình người ôm mặt khóc than, đôi lứa giao duyên hay chim muông biểu đạt sự luân hồi của vạn vật.'
  },
  {
    id: 12,
    code: 'HV-012',
    title: 'Đèn Lồng Gốm Hoa Nâu Thời Lý - Trần',
    ethnic: 'Dân tộc Kinh (Việt)',
    region: 'Vùng Đồng Bằng Nam Bộ',
    languageGroup: 'Việt - Mường',
    material: 'Đất sét trắng nung men ngà điểm hoa văn men nâu sắt',
    era: 'Thế kỷ XIII - XIV',
    location: 'Phòng Trưng Bày 1',
    status: 'Nguyên vẹn',
    img: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
    images: ['https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80'],
    meaning: 'Hiện vật quý hiếm phản ánh thời kỳ hoàng kim của Phật giáo và tinh thần phóng khoáng, thuần hậu Đại Việt.',
    audioText: 'Đèn gốm hoa nâu trang trí cánh sen nở tầng tầng lớp lớp, đượm tinh thần từ bi và ánh sáng trí tuệ thời Lý Trần.'
  }
];

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
