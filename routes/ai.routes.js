const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const pool = require('../config/db');

// Khởi tạo Gemini AI Client từ API Key trong .env
let ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function calling Gemini AI with timeout
async function generateGeminiWithFallback(contents, systemInstruction) {
  const models = [
    'gemini-3.6-flash'
  ];

  let lastErr = null;

  const currentKey = process.env.GEMINI_API_KEY;

  if (!currentKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình!');
  }

  const client = new GoogleGenAI({
    apiKey: currentKey
  });

  for (const model of models) {
    try {
      console.log(`🤖 Đang gọi Gemini model: ${model}`);

      const request = client.models.generateContent({
        model: model,
        contents: contents,
        config: {
          systemInstruction
        }
      });

      const timeout = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error('Gemini API timeout sau 15 giây')
          );
        }, 15000);
      });

      const response = await Promise.race([
        request,
        timeout
      ]);

      if (response && response.text) {
        console.log('✅ Gemini trả lời thành công');
        return response.text;
      }

      throw new Error('Gemini không trả về nội dung');

    } catch (err) {
      console.warn(
        `⚠️ Gemini ${model} lỗi: ${err.message}`
      );

      lastErr = err;
    }
  }

  throw lastErr;
}

// Smart offline curator knowledge fallback when external network/API is momentarily unreachable
function getOfflineCuratorResponse(question, artifactContext) {
  const q = (question || '').trim().toLowerCase();

  if (q.includes('xin chào') || q.includes('chào') || q.includes('hello') || q.includes('hi')) {
    return 'Xin chào quý khách! Tôi là Trợ lý Virtual AI của Bảo tàng Văn hóa các Dân tộc Việt Nam. Tôi có thể hỗ trợ bạn tìm hiểu về 54 dân tộc, 5 phòng trưng bày, giá vé, giờ mở cửa. Bạn cần tư vấn thông tin gì hôm nay?';
  }

  if (q.includes('giá vé') || q.includes('bao nhiêu') || q.includes('vé vào')) {
    return 'Bảo tàng áp dụng mức giá vé tham quan quy định:\n- Vé người lớn / phổ thông: 30.000 VNĐ/lượt.\n- Vé trẻ em dưới 5 tuổi: Miễn phí hoàn toàn (0 VNĐ).\nQuý khách có thể mua vé trực tuyến và quét mã QR tại cổng kiểm soát tự động.';
  }
  if (q.includes('giờ mở') || q.includes('thời gian') || q.includes('khi nào')) {
    return 'Bảo tàng mở cửa đón khách tham quan tất cả các ngày trong tuần (kể cả Thứ Bảy, Chủ Nhật và ngày Lễ):\n- Buổi sáng: 08:00 - 11:30\n- Buổi chiều: 13:30 - 17:00.';
  }
  if (q.includes('phòng') || q.includes('trưng bày')) {
    return 'Bảo tàng gồm 5 Phòng trưng bày trong nhà theo nhóm ngôn ngữ:\n- Phòng 1: Nhóm Việt - Mường.\n- Phòng 2: Nhóm Tày - Thái.\n- Phòng 3: Nhóm H\'mông - Dao, Ka Đai & Tạng Miến.\n- Phòng 4: Nhóm Môn - Khơ mer.\n- Phòng 5: Nhóm Nam Đảo & Nhóm Hán.\nNgoài ra có 6 Vùng không gian văn hóa ngoài trời tái hiện chân thực các ngôi nhà nguyên gốc.';
  }

  return 'Chào bạn! Tôi là Trợ lý AI Bảo tàng Văn hóa các Dân tộc Việt Nam. Tôi luôn sẵn sàng hỗ trợ bạn tra cứu thông tin vận hành, dịch vụ tham quan và di sản văn hóa dân tộc. Bạn có thể hỏi bất kỳ câu hỏi nào liên quan đến bảo tàng nhé!';
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
/**
 * POST /api/ai/query
 * Admin Natural Language Query - đọc dữ liệu trực tiếp từ SQLite
 */
router.post('/query', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập câu hỏi tự nhiên cho AI Administrator!'
    });
  }

  const question = prompt.trim();
  const q = question.toLowerCase();

  try {
    // =========================================================
    // 1. ĐỌC DỮ LIỆU TRỰC TIẾP TỪ SQLITE
    // =========================================================

    // Tổng số hiện vật
    const [artifactRows] = await pool.query(`
      SELECT COUNT(*) AS totalArtifacts
      FROM HienVat
    `);

    const totalArtifacts = Number(
      artifactRows[0]?.totalArtifacts || 0
    );

    // =========================================================
    // 2. TRẢ LỜI TRỰC TIẾP CÁC CÂU HỎI VỀ HIỆN VẬT
    // =========================================================

    if (
      q.includes('hiện vật') ||
      q.includes('hien vat') ||
      q.includes('di sản') ||
      q.includes('di san') ||
      q.includes('kho')
    ) {
      // Hỏi số lượng
      if (
        q.includes('bao nhiêu') ||
        q.includes('số lượng') ||
        q.includes('so luong') ||
        q.includes('tổng số') ||
        q.includes('tong so')
      ) {
        return res.json({
          success: true,
          data: {
            summary: 'Kết quả truy vấn SQLite',
            details:
              `Hiện tại cơ sở dữ liệu bảo tàng đang ghi nhận ${totalArtifacts} hiện vật trong bảng HienVat.`,
            source: 'SQLite'
          }
        });
      }

      // Hỏi danh sách hiện vật
      if (
        q.includes('danh sách') ||
        q.includes('danh sach') ||
        q.includes('những hiện vật') ||
        q.includes('cac hien vat')
      ) {
        const [artifactList] = await pool.query(`
          SELECT
            hienvat_id,
            ma_hienvat,
            ten_hienvat,
            chat_lieu,
            nien_dai,
            tinh_trang
          FROM HienVat
          ORDER BY hienvat_id DESC
          LIMIT 50
        `);

        if (artifactList.length === 0) {
          return res.json({
            success: true,
            data: {
              summary: 'Dữ liệu hiện vật',
              details: 'Hiện tại chưa có hiện vật nào trong cơ sở dữ liệu SQLite.',
              source: 'SQLite'
            }
          });
        }

        const listText = artifactList.map((item, index) => {
          return `${index + 1}. ${item.ten_hienvat || 'Chưa có tên'}`
            + ` | Mã: ${item.ma_hienvat || 'N/A'}`
            + ` | Chất liệu: ${item.chat_lieu || 'N/A'}`
            + ` | Niên đại: ${item.nien_dai || 'N/A'}`
            + ` | Tình trạng: ${item.tinh_trang || 'N/A'}`;
        }).join('\n');

        return res.json({
          success: true,
          data: {
            summary: `Danh sách ${artifactList.length} hiện vật`,
            details: listText,
            source: 'SQLite'
          }
        });
      }
    }

    // =========================================================
    // 3. CÁC THỐNG KÊ KHÁC
    //    Chỉ lấy từ SQLite nếu bảng tồn tại.
    // =========================================================

    let totalTickets = 0;
    let totalVisitors = 0;
    let totalRevenue = 0;

    try {
      const [ticketRows] = await pool.query(`
        SELECT
          COUNT(*) AS totalTickets,
          COALESCE(SUM(total_qty), 0) AS totalVisitors,
          COALESCE(SUM(amount), 0) AS totalRevenue
        FROM VeThamQuan
      `);

      if (ticketRows.length > 0) {
        totalTickets = Number(ticketRows[0].totalTickets || 0);
        totalVisitors = Number(ticketRows[0].totalVisitors || 0);
        totalRevenue = Number(ticketRows[0].totalRevenue || 0);
      }
    } catch (ticketError) {
      console.warn(
        'Không thể đọc bảng VeThamQuan:',
        ticketError.message
      );
    }

    // =========================================================
    // 4. TRẢ LỜI TRỰC TIẾP CÁC CÂU HỎI THỐNG KÊ
    // =========================================================

    if (
      q.includes('doanh thu') ||
      q.includes('doanh số')
    ) {
      return res.json({
        success: true,
        data: {
          summary: 'Doanh thu từ SQLite',
          details:
            `Tổng doanh thu ghi nhận trong bảng VeThamQuan là ${totalRevenue.toLocaleString('vi-VN')} VNĐ.`,
          source: 'SQLite'
        }
      });
    }

    if (
      q.includes('lượt khách') ||
      q.includes('luot khach') ||
      q.includes('bao nhiêu khách') ||
      q.includes('bao nhieu khach')
    ) {
      return res.json({
        success: true,
        data: {
          summary: 'Lượt khách từ SQLite',
          details:
            `Tổng số lượt khách được ghi nhận trong hệ thống là ${totalVisitors.toLocaleString('vi-VN')} lượt.`,
          source: 'SQLite'
        }
      });
    }

    if (
      q.includes('bao nhiêu vé') ||
      q.includes('bao nhieu ve') ||
      q.includes('số vé') ||
      q.includes('so ve')
    ) {
      return res.json({
        success: true,
        data: {
          summary: 'Số vé từ SQLite',
          details:
            `Hệ thống đang ghi nhận ${totalTickets.toLocaleString('vi-VN')} vé trong bảng VeThamQuan.`,
          source: 'SQLite'
        }
      });
    }

    // =========================================================
    // 5. CÂU HỎI TỔNG QUAN
    // =========================================================

    if (
      q.includes('tổng quan') ||
      q.includes('tong quan') ||
      q.includes('tình hình') ||
      q.includes('tinh hinh') ||
      q.includes('thống kê') ||
      q.includes('thong ke')
    ) {
      return res.json({
        success: true,
        data: {
          summary: 'Tổng quan dữ liệu bảo tàng',
          details:
            `Báo cáo dữ liệu thực tế từ SQLite:\n` +
            `- Tổng số hiện vật: ${totalArtifacts.toLocaleString('vi-VN')} hiện vật.\n` +
            `- Tổng số vé: ${totalTickets.toLocaleString('vi-VN')} vé.\n` +
            `- Tổng lượt khách: ${totalVisitors.toLocaleString('vi-VN')} lượt.\n` +
            `- Tổng doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VNĐ.`,
          source: 'SQLite'
        }
      });
    }

    // =========================================================
    // 6. NẾU CÂU HỎI PHỨC TẠP -> GỬI GEMINI
    //    NHƯNG GEMINI NHẬN DỮ LIỆU THẬT TỪ SQLITE
    // =========================================================

    const databaseContext = `
DỮ LIỆU THỰC TẾ ĐỌC TRỰC TIẾP TỪ SQLITE:

- Tổng số hiện vật: ${totalArtifacts}
- Tổng số vé: ${totalTickets}
- Tổng lượt khách: ${totalVisitors}
- Tổng doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VNĐ

Nguồn dữ liệu: SQLite database của hệ thống bảo tàng.
Không được tự bịa thêm số liệu.
Nếu câu hỏi không thể trả lời từ các số liệu trên, hãy nói rõ rằng dữ liệu hiện tại chưa đủ.
`;

    const systemInstruction = `
Bạn là AI Trợ lý Quản trị Dữ liệu của Bảo tàng Văn hóa các Dân tộc Việt Nam.

NHIỆM VỤ:
- Phân tích câu hỏi của quản trị viên.
- Sử dụng chính xác dữ liệu SQLite được cung cấp.
- Không tự tạo hoặc đoán số liệu.
- Không sử dụng số liệu cũ từ frontend.
- Trả lời bằng tiếng Việt.
- Trả lời ngắn gọn, rõ ràng.
- Không dùng Markdown dạng ** hoặc *.
- Khi liệt kê, dùng dấu "-".

${databaseContext}
`;

    try {
      const detailsText = await generateGeminiWithFallback(
        question,
        systemInstruction
      );

      return res.json({
        success: true,
        data: {
          summary: 'Kết quả phân tích dữ liệu thực tế',
          details: detailsText,
          source: 'SQLite + Gemini'
        }
      });
    } catch (geminiError) {
      console.error(
        'Gemini không phản hồi, sử dụng dữ liệu SQLite:',
        geminiError.message
      );

      // =====================================================
      // 7. GEMINI LỖI -> VẪN TRẢ DỮ LIỆU SQLITE
      //    KHÔNG TRẢ CÂU MẪU CŨ
      // =====================================================

      return res.json({
        success: true,
        data: {
          summary: 'Kết quả truy vấn dữ liệu thực tế',
          details:
            `Dữ liệu hiện tại từ cơ sở dữ liệu SQLite:\n` +
            `- Hiện vật: ${totalArtifacts.toLocaleString('vi-VN')}\n` +
            `- Vé đã ghi nhận: ${totalTickets.toLocaleString('vi-VN')}\n` +
            `- Lượt khách: ${totalVisitors.toLocaleString('vi-VN')}\n` +
            `- Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VNĐ\n\n` +
            `Gemini hiện không phản hồi, vì vậy hệ thống đã trả kết quả trực tiếp từ SQLite.`,
          source: 'SQLite'
        }
      });
    }

  } catch (error) {
    console.error('❌ Lỗi /api/ai/query:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể truy vấn dữ liệu SQLite.',
      error: error.message
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
