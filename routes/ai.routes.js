const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

// Khởi tạo Gemini AI Client từ API Key trong .env
let ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function calling Gemini AI with automatic model fallback for high availability
async function generateGeminiWithFallback(contents, systemInstruction) {
  const models = [
    'gemini-3.6-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];
  let lastErr = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: { systemInstruction }
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      console.warn(`Model ${model} failed (${err.message}), trying next fallback model...`);
      lastErr = err;
    }
  }
  throw lastErr;
}

// Smart offline curator knowledge fallback when external network/API is momentarily unreachable
function getOfflineCuratorResponse(question, artifactContext) {
  const q = (question || '').toLowerCase();
  
  if (q.includes('giá vé') || q.includes('bao nhiêu') || q.includes('vé vào')) {
    return 'Bảo tàng áp dụng mức giá vé tham quan quy định:\n- Vé người lớn / phổ thông: 30.000 VNĐ/lượt.\n- Vé trẻ em dưới 5 tuổi: Miễn phí hoàn toàn (0 VNĐ).\nQuý khách có thể mua vé trực tuyến và quét mã QR tại cổng kiểm soát tự động.';
  }
  if (q.includes('giờ mở') || q.includes('thời gian') || q.includes('khi nào')) {
    return 'Bảo tàng mở cửa đón khách tham quan tất cả các ngày trong tuần (kể cả Thứ Bảy, Chủ Nhật và ngày Lễ):\n- Buổi sáng: 08:00 - 11:30\n- Buổi chiều: 13:30 - 17:00.';
  }
  if (q.includes('phòng') || q.includes('trưng bày')) {
    return 'Bảo tàng gồm 5 Phòng trưng bày trong nhà theo nhóm ngôn ngữ:\n- Phòng 1: Nhóm Việt - Mường.\n- Phòng 2: Nhóm Tày - Thái.\n- Phòng 3: Nhóm H\'mông - Dao, Ka Đai & Tạng Miến.\n- Phòng 4: Nhóm Môn - Khơ mer.\n- Phòng 5: Nhóm Nam Đảo & Nhóm Hán.\nNgoài ra có 6 Vùng không gian văn hóa ngoài trời tái hiện chân thực các ngôi nhà nguyên gốc.';
  }
  if (q.includes('tày') || q.includes('trang phục tày') || q.includes('chàm')) {
    return 'Trang phục cổ truyền người Tày nổi bật với sắc chàm mộc mạc mà trang nhã. Áo cánh ngắn mặc bên trong kết hợp áo dài năm thân cài khuy đồng bên nách phải, thắt lưng lụa rực rỡ và nón lá chóp nhọn đan bằng tre cật.';
  }
  if (q.includes('trống đồng') || q.includes('đông sơn')) {
    return 'Trống đồng Đông Sơn là đỉnh cao của nền văn minh kim khí Lạc Việt thế kỷ II-III TCN. Hoa văn ngôi sao mặt trời tỏa sáng ở tâm, bao quanh là các vành chim Lạc bay ngược chiều kim đồng hồ cùng cảnh chiến binh trên thuyền và giã gạo.';
  }
  if (q.includes('t\'rưng') || q.includes('trưng') || q.includes('đàn')) {
    return 'Đàn T\'rưng là nhạc cụ gõ độc đáo của các dân tộc Tây Nguyên (Gia Rai, Ba Na). Đàn được chế tác từ những ống nứa tự nhiên có độ dài ngắn khác nhau, âm thanh vang vọng, ngân nga như suối reo giữa núi rừng.';
  }
  if (q.includes('khèn') || q.includes('mông') || q.includes('h\'mông')) {
    return 'Khèn là linh hồn của đồng bào H\'Mông. Khèn vừa là nhạc cụ gọi bạn tình trong các phiên chợ phiên mùa xuân, vừa là cầu nối tâm linh không thể thiếu trong các nghi lễ vòng đời truyền thống.';
  }
  if (q.includes('piêu') || q.includes('thái')) {
    return 'Khăn Piêu là kiệt tác thêu thùa của phụ nữ Thái Tây Bắc. Họa tiết cút piêu hình trăng sao, ngọn rau dớn, con bướm thể hiện thế giới quan sinh động và tấm lòng thủy chung, khéo léo của người con gái Thái.';
  }
  if (q.includes('cồng chiêng') || q.includes('ba na')) {
    return 'Không gian Văn hóa Cồng chiêng Tây Nguyên là Di sản phi vật thể đại diện của nhân loại được UNESCO vinh danh. Tiếng chiêng là tiếng nói thiêng liêng kết nối con người với thần linh Yang trong các lễ hội đâm trâu, mừng lúa mới.';
  }

  return 'Chào bạn! Tôi là Trợ lý AI Bảo tàng Văn hóa các Dân tộc Việt Nam. Hiện vật này lưu giữ giá trị lịch sử và mỹ thuật thủ công truyền thống độc đáo của 54 dân tộc anh em. Bạn có thể hỏi thêm về nguồn gốc, chất liệu, niên đại hoặc ý nghĩa hoa văn của hiện vật nhé!';
}

/**
 * POST /api/ai/chat
 * Trợ lý AI Bảo tàng trả lời câu hỏi trực tiếp qua Google Gemini API
 */
router.post('/chat', async (req, res) => {
  const { question, artifactId } = req.body;

  if (!question) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi!' });
  }

  try {
    const systemInstruction = `Bạn là Trợ lý AI chuyên gia thông minh của Bảo tàng Văn hóa các Dân tộc Việt Nam (Thái Nguyên).

QUY TẮC PHẢN HỒI (MẮC ĐỊNH):
1. Trả lời NGẮN GỌN, SÚC TÍCH, DỄ HIỂU (tối đa 2-4 câu hoặc 2-3 gạch đầu dòng ngắn), đi thẳng vào trọng tâm câu hỏi. Không chào hỏi dài dòng rườm rà.
2. KHÔNG sử dụng ký tự Markdown dạng dấu sao (*) hay (**) trong câu trả lời. Hãy viết chữ thường tự nhiên.
3. Nếu cần liệt kê, dùng dấu gạch ngang "-" ở đầu dòng.

THÔNG TIN BẢO TÀNG THỰC TẾ:
- Trưng bày Trong Nhà (5 Phòng):
  + Phòng 1: Nhóm ngôn ngữ Việt - Mường (Việt, Mường, Thổ, Chứt).
  + Phòng 2: Nhóm ngôn ngữ Tày - Thái (Tày, Thái, Nùng, Giáy, Lào, Lự, Sán Chay, Bố Y).
  + Phòng 3: Nhóm H'mông - Dao, Ka Đai & Tạng Miến.
  + Phòng 4: Nhóm ngôn ngữ Môn - Khơ mer (21 tộc người).
  + Phòng 5: Nhóm ngôn ngữ Nam Đảo & Nhóm Hán.
- Trưng bày Ngoài Trời (6 Vùng văn hóa sinh thái với kiến trúc nhà nguyên gốc & lễ hội): Vùng núi cao phía Bắc, Vùng Thung lũng, Vùng Trung du - Bắc Bộ, Vùng miền Trung - Ven biển, Vùng Trường Sơn - Tây Nguyên, Vùng Đồng Bằng Nam Bộ.
- Giá vé: 30.000 VNĐ/người lớn, Miễn phí trẻ em dưới 5 tuổi. Giờ mở cửa: 08:00 - 11:30 và 13:30 - 17:00 tất cả các ngày.`;

    const answerText = await generateGeminiWithFallback(question, systemInstruction);

    return res.json({
      success: true,
      question: question,
      answer: answerText
    });
  } catch (error) {
    console.error('Lỗi Gemini AI API Chat, kích hoạt offline curator fallback:', error.message);
    const fallbackAnswer = getOfflineCuratorResponse(question, artifactId);
    return res.json({
      success: true,
      question: question,
      answer: fallbackAnswer,
      isFallback: true
    });
  }
});

/**
 * POST /api/ai/query
 * Admin Natural Language NLP Query qua Google Gemini API
 */
router.post('/query', async (req, res) => {
  const { prompt, contextStats } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi tự nhiên cho AI Administrator!' });
  }

  try {
    const stats = contextStats || {};
    const totalVisitors = stats.totalVisitors || 0;
    const totalRevenue = stats.totalRevenue || 0;
    const totalArtifacts = stats.totalArtifacts || 0;

    const systemInstruction = `Bạn là AI Trợ lý Quản trị & Trí tuệ Dữ liệu (Admin Data Intelligence AI) của Bảo tàng Văn hóa các Dân tộc Việt Nam (Thái Nguyên). Khi Cán bộ hoặc Lãnh đạo đặt câu hỏi truy vấn tự nhiên về kho hiện vật, báo cáo doanh thu, lượt khách hay công tác bảo quản:
- Hãy phân tích và trả lời súc tích, cấu trúc rõ ràng với các mục tóm tắt số liệu, thông kê chi tiết và khuyến nghị quản lý.
- KHÔNG sử dụng ký tự Markdown dạng dấu sao (*) hay (**). Dùng dấu gạch ngang "-" khi liệt kê.
- DỮ LIỆU THỰC TẾ ĐANG VẬN HÀNH TRÊN HỆ THỐNG QUẢN TRỊ BẢO TÀNG:
  + Bảng giá vé hiện hành thực tế: Vé Tham Quan Bảo Tàng (Phổ thông/Người lớn): 30.000 VNĐ/lượt; Vé Trẻ Em dưới 5 tuổi: Miễn phí (0 VNĐ).
  + Báo cáo số liệu thực tế hệ thống đã ghi nhận:
    * Tổng số vé/lượt khách đã bán và lưu vết: ${totalVisitors} lượt vé.
    * Tổng doanh thu thực tế ghi nhận: ${totalRevenue.toLocaleString('vi-VN')} VNĐ.
    * Tổng số hồ sơ hiện vật di sản trong cơ sở dữ liệu: ${totalArtifacts} hiện vật.
  + Hệ thống cơ sở vật chất bảo tàng:
    * 5 Phòng trưng bày trong nhà (Phòng 1, Phòng 2, Phòng 3, Phòng 4, Phòng 5) theo các nhóm ngôn ngữ.
    * 6 Vùng không gian văn hóa sinh thái ngoài trời (Vùng núi cao phía Bắc, Thung lũng, Trung du-Bắc Bộ, Miền Trung-Ven biển, Trường Sơn-Tây Nguyên, Đồng Bằng Nam Bộ).
    * Hệ thống Kho bảo quản 1.
  + Tình trạng vật lý hiện vật: Hầu hết nguyên vẹn và được theo dõi lịch bảo quản định kỳ.`;

    const detailsText = await generateGeminiWithFallback(prompt, systemInstruction);

    return res.json({
      success: true,
      data: {
        summary: `Kết quả phân tích dữ liệu quản trị thực tế qua Trợ lý AI Bảo tàng`,
        details: detailsText
      }
    });
  } catch (error) {
    console.error('Lỗi AI Query, kích hoạt fallback:', error.message);
    const stats = req.body.contextStats || {};
    const totalVisitors = stats.totalVisitors || 0;
    const totalRevenue = stats.totalRevenue || 0;
    const totalArtifacts = stats.totalArtifacts !== undefined ? stats.totalArtifacts : 0;

    return res.json({
      success: true,
      data: {
        summary: 'Kết quả phân tích thống kê quản trị bảo tàng',
        details: `Báo cáo tình hình vận hành bảo tàng:\n- Lượt khách đã đón: ${totalVisitors} lượt khách tham quan.\n- Doanh thu bán vé ghi nhận: ${totalRevenue.toLocaleString('vi-VN')} VNĐ.\n- Tổng số hiện vật trong cơ sở dữ liệu: ${totalArtifacts} hiện vật di sản thuộc 54 dân tộc.\n- Tình trạng kỹ thuật: Hệ thống 5 phòng trưng bày và kho bảo quản vận hành ổn định.`
      }
    });
  }
});

/**
 * GET /api/ai/config
 * Lấy thông tin trạng thái cấu hình API Key
 */
router.get('/config', (req, res) => {
  const rawKey = process.env.GEMINI_API_KEY || '';
  const hasKey = Boolean(rawKey && rawKey.trim());
  const maskedKey = rawKey.length > 10 
    ? `${rawKey.substring(0, 7)}...${rawKey.substring(rawKey.length - 4)}` 
    : (hasKey ? '********' : 'Chưa cấu hình');

  res.json({
    success: true,
    hasKey,
    maskedKey,
    rawKey: rawKey,
    model: 'gemini-3.6-flash',
    fallbackModels: ['gemini-2.5-flash', 'gemini-flash-latest'],
    status: hasKey ? 'READY' : 'MISSING_KEY',
    statusText: hasKey ? 'Đã kết nối & Sẵn sàng hoạt động' : 'Chưa cấu hình API Key'
  });
});

/**
 * POST /api/ai/config
 * Lưu và cập nhật API Key mới (cả runtime và file .env)
 */
router.post('/config', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập API Key hợp lệ!' });
  }

  const cleanKey = apiKey.trim();
  process.env.GEMINI_API_KEY = cleanKey;
  ai = new GoogleGenAI({ apiKey: cleanKey });

  // Ghi cập nhật vào file .env
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${cleanKey}`);
      } else {
        envContent += `\nGEMINI_API_KEY=${cleanKey}`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
    }
  } catch (fsErr) {
    console.warn('Không thể ghi file .env:', fsErr.message);
  }

  return res.json({
    success: true,
    message: 'Đã lưu và cập nhật cấu hình API Key thành công!',
    maskedKey: `${cleanKey.substring(0, 7)}...${cleanKey.substring(cleanKey.length - 4)}`
  });
});

/**
 * POST /api/ai/test
 * Kiểm tra kết nối trực tiếp đến Google AI Server với đo độ trễ (latency)
 */
router.post('/test', async (req, res) => {
  const startTime = Date.now();
  try {
    const testKey = req.body.apiKey ? req.body.apiKey.trim() : process.env.GEMINI_API_KEY;
    if (!testKey) {
      return res.status(400).json({ success: false, message: 'Chưa có API Key để kiểm tra!' });
    }

    const testClient = new GoogleGenAI({ apiKey: testKey });
    const response = await testClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Xin chào, phản hồi ngắn gọn 1 câu để kiểm tra kết nối hệ thống.'
    });

    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      latency,
      message: `Kết nối API thành công (${latency}ms)! Trợ lý AI sẵn sàng phản hồi.`,
      sampleResponse: response.text ? response.text.trim() : 'OK'
    });
  } catch (err) {
    console.error('Lỗi kiểm tra API Key:', err.message);
    return res.status(500).json({
      success: false,
      message: `Không thể kết nối đến server AI: ${err.message}`
    });
  }
});

module.exports = router;
