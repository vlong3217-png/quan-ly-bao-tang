const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const pool = require('../config/db');
const ragService = require('../services/rag.service');

// Helper function calling Gemini AI with fallback model list
async function generateGeminiWithFallback(contents, systemInstruction) {
  const models = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite'
  ];

  let lastErr = null;
  const currentKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!currentKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình!');
  }

  const client = new GoogleGenAI({ apiKey: currentKey });

  for (const model of models) {
    try {
      console.log(`🤖 Đang gọi Gemini model: ${model}`);

      const request = client.models.generateContent({
        model: model,
        contents: contents,
        config: { systemInstruction }
      });

      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Gemini API timeout sau 15s với model ${model}`)), 15000);
      });

      const response = await Promise.race([request, timeout]);

      if (response && response.text) {
        console.log(`✅ Gemini model ${model} trả lời thành công`);
        return response.text;
      }
    } catch (err) {
      console.warn(`⚠️ Gemini ${model} lỗi: ${err.message}`);
      lastErr = err;
    }
  }

  throw lastErr || new Error('Không thể kết nối đến Gemini AI.');
}

// Helper function streaming Gemini AI response with fallback model list
async function generateGeminiStreamWithFallback(contents, systemInstruction, onChunk) {
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ];

  let lastErr = null;
  const currentKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!currentKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình!');
  }

  const client = new GoogleGenAI({ apiKey: currentKey });

  for (const model of models) {
    try {
      console.log(`🤖 Đang stream Gemini model: ${model}`);

      const responseStream = await client.models.generateContentStream({
        model: model,
        contents: contents,
        config: { systemInstruction }
      });

      let hasChunk = false;
      for await (const chunk of responseStream) {
        if (chunk && chunk.text) {
          hasChunk = true;
          onChunk(chunk.text);
        }
      }

      if (hasChunk) {
        console.log(`✅ Gemini stream model ${model} thành công`);
        return true;
      }
    } catch (err) {
      console.warn(`⚠️ Gemini stream ${model} lỗi: ${err.message}`);
      lastErr = err;
    }
  }

  throw lastErr || new Error('Không thể kết nối đến Gemini AI Stream.');
}

// Xây dựng ngữ cảnh dữ liệu thực tế sống từ SQLite database
async function buildLiveMuseumContext() {
  try {
    // 1. Thống kê & Danh sách Hiện vật trong SQLite
    const [hvTotal] = await pool.query('SELECT COUNT(*) as count FROM HienVat');
    const totalArtifacts = hvTotal[0]?.count || 0;

    const [hvList] = await pool.query(`
      SELECT ma_hienvat, ten_hienvat, dan_toc, chat_lieu, tinh_trang, vi_tri_kho
      FROM HienVat ORDER BY hienvat_id DESC LIMIT 30
    `);

    // 2. Thống kê Vé & Doanh thu trong SQLite
    const [veStats] = await pool.query(`
      SELECT 
        COUNT(*) as totalTickets,
        COALESCE(SUM(so_nguoi_lon + so_sinh_vien + so_tre_em + so_nguoi_nuoc_ngoai), 0) as totalVisitors,
        COALESCE(SUM(tong_tien), 0) as totalRevenue
      FROM VeThamQuan
    `);
    const totalTickets = veStats[0]?.totalTickets || 0;
    const totalVisitors = veStats[0]?.totalVisitors || 0;
    const totalRevenue = veStats[0]?.totalRevenue || 0;

    const [ticketList] = await pool.query(`
      SELECT ma_qr, ten_khach, so_dien_thoai, tong_tien, trang_thai, ngay_mua
      FROM VeThamQuan ORDER BY ve_id DESC LIMIT 10
    `);

    // 3. Lịch đoàn tham quan trong SQLite
    const [doanTotal] = await pool.query('SELECT COUNT(*) as count FROM LichDoan');
    const totalDoan = doanTotal[0]?.count || 0;

    const [doanList] = await pool.query(`
      SELECT code, name, province, size, time, guide, status
      FROM LichDoan ORDER BY id DESC LIMIT 15
    `);

    // 4. Danh sách Cán bộ trong SQLite
    const [userList] = await pool.query(`
      SELECT username, full_name, role, email, phone, is_locked FROM Users
    `);

    // Định dạng danh sách dạng chuỗi
    const hvText = hvList.length > 0
      ? hvList.map((a, i) => `${i + 1}. [Mã: ${a.ma_hienvat || 'N/A'}] ${a.ten_hienvat} - Dân tộc: ${a.dan_toc || 'N/A'}, Chất liệu: ${a.chat_lieu || 'N/A'}, Tình trạng: ${a.tinh_trang || 'N/A'}, Kho: ${a.vi_tri_kho || 'N/A'}`).join('\n')
      : '- Chưa có hiện vật di sản nào lưu trong cơ sở dữ liệu SQLite.';

    const ticketText = ticketList.length > 0
      ? ticketList.map((t, i) => `${i + 1}. Mã QR: ${t.ma_qr} | Khách: ${t.ten_khach || 'Khách lẻ'} (${t.so_dien_thoai || 'N/A'}) | Tổng tiền: ${(t.tong_tien || 0).toLocaleString('vi-VN')} VNĐ | Trạng thái: ${t.trang_thai}`).join('\n')
      : '- Chưa có lịch sử bán vé nào trong cơ sở dữ liệu SQLite.';

    const doanText = doanList.length > 0
      ? doanList.map((d, i) => `${i + 1}. [Mã: ${d.code || 'N/A'}] Đoàn ${d.name} (${d.province || 'Nội tỉnh'}) - Số lượng: ${d.size || 0} người, Thời gian: ${d.time || 'N/A'}, Hướng dẫn viên: ${d.guide || 'Chưa phân công'}, Trạng thái: ${d.status}`).join('\n')
      : '- Chưa có lịch đoàn tham quan nào trong cơ sở dữ liệu SQLite.';

    const userText = userList.length > 0
      ? userList.map((u, i) => `${i + 1}. ${u.full_name || u.username} (@${u.username}) - Vai trò: ${u.role}, Email: ${u.email || 'N/A'}, SĐT: ${u.phone || 'N/A'}, Trạng thái: ${u.is_locked ? 'Đã khóa' : 'Hoạt động'}`).join('\n')
      : '- Chưa có thông tin cán bộ.';

    return `
DỮ LIỆU THỰC TẾ ĐANG VẬN HÀNH TRÊN HỆ THỐNG QUẢN TRỊ BẢO TÀNG (TRÍCH XUẤT TRỰC TIẾP TỪ SQLITE DATABASE):

1. KHO HIỆN VẬT DI SẢN:
- Tổng số hồ sơ hiện vật hiện có: ${totalArtifacts} hiện vật.
- Các hiện vật di sản gần đây:
${hvText}

2. VÉ THAM QUAN & DOANH THU THỰC TẾ:
- Tổng số vé đã tạo/bán: ${totalTickets} vé.
- Tổng số lượt khách tham quan: ${totalVisitors.toLocaleString('vi-VN')} lượt khách.
- Tổng doanh thu bán vé thực tế ghi nhận: ${totalRevenue.toLocaleString('vi-VN')} VNĐ.
- Giao dịch vé mới nhất:
${ticketText}

3. LỊCH ĐOÀN THAM QUAN:
- Tổng số đoàn đăng ký tham quan: ${totalDoan} đoàn.
- Các đoàn tham quan gần đây:
${doanText}

4. DANH SÁCH CÁN BỘ VẬN HÀNH:
${userText}

5. THÔNG TIN QUY ĐỊNH & THỜI GIAN MỞ CỬA BẢO TÀNG:
- Giờ mở cửa đón khách: Buổi sáng 08:00 - 11:30, Buổi chiều 13:30 - 17:00 (mở tất cả các ngày trong tuần, kể cả Thứ 7, Chủ Nhật và Lễ Tết).
- Giá vé quy định: Vé người lớn/phổ thông 30.000 VNĐ/lượt; Vé trẻ em dưới 5 tuổi miễn phí hoàn toàn (0 VNĐ).
- Trưng bày: 5 Phòng trưng bày trong nhà theo nhóm ngôn ngữ & 6 Vùng không gian văn hóa sinh thái ngoài trời.
`;
  } catch (err) {
    console.error('Lỗi xây dựng context từ SQLite:', err);
    return 'Không thể kết nối cơ sở dữ liệu SQLite.';
  }
}

// Phản hồi dự phòng thông minh dựa trên dữ liệu SQLite và tài liệu RAG khi Gemini API không khả dụng
function getDynamicOfflineResponse(question, liveContext, currentArtifactContext) {
  const q = (question || '').trim().toLowerCase();

  if (q.includes('xin chào') || q.includes('chào') || q.includes('hello') || q.includes('hi')) {
    return 'Xin chào quý khách! Tôi là Trợ lý AI Bảo tàng Văn hóa các Dân tộc Việt Nam. Tôi luôn sẵn sàng hỗ trợ bạn tra cứu thông tin vận hành, di sản hiện vật, lịch đoàn và vé tham quan dựa trên dữ liệu thực tế và tài liệu nghiên cứu chuyên sâu.';
  }

  if (currentArtifactContext) {
    return `Thông tin thực tế hiện vật trích xuất từ cơ sở dữ liệu:\n` + currentArtifactContext;
  }

  // Tra cứu câu trả lời trích xuất từ kho tri thức RAG bảo tàng
  const ragAnswer = ragService.generateOfflineRagAnswer(question);
  if (ragAnswer) {
    return ragAnswer;
  }

  return `Báo cáo thông tin thực tế trích xuất từ cơ sở dữ liệu SQLite Bảo tàng:\n\n` + liveContext;
}

/**
 * POST /api/ai/chat
 * Trợ lý AI Bảo tàng trả lời câu hỏi tự nhiên bằng Gemini AI + Dữ liệu SQLite sống
 */
router.post('/chat', async (req, res) => {
  const { question, artifactId, imageSrc, isImageAnalysis, stream } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi!' });
  }

  const liveContext = await buildLiveMuseumContext();
  const ragData = ragService.buildRagPromptContext(question, 4);

  // Lấy ngữ cảnh hiện vật cụ thể nếu người dùng đang đứng ở màn hình chi tiết hiện vật
  let currentArtifactContext = '';
  if (artifactId) {
    try {
      const [artRows] = await pool.query(
        `SELECT ma_hienvat, ten_hienvat, dan_toc, chat_lieu, tinh_trang, vi_tri_kho, y_nghia_van_hoa, vung_van_hoa
         FROM HienVat
         WHERE hienvat_id = ? OR ma_hienvat = ?
         LIMIT 1`,
        [String(artifactId), String(artifactId)]
      );
      if (artRows && artRows.length > 0) {
        const a = artRows[0];
        currentArtifactContext = `\nHIỆN VẬT NGƯỜI DÙNG ĐANG XEM TRỰC TIẾP TRÊN MÀN HÌNH:
- Tên hiện vật: ${a.ten_hienvat}
- Mã hiện vật: ${a.ma_hienvat || 'N/A'}
- Dân tộc: ${a.dan_toc || 'N/A'}
- Vùng văn hóa: ${a.vung_van_hoa || 'N/A'}
- Chất liệu: ${a.chat_lieu || 'N/A'}
- Tình trạng: ${a.tinh_trang || 'N/A'}
- Vị trí lưu trữ: ${a.vi_tri_kho || 'N/A'}
- Ý nghĩa văn hóa: ${a.y_nghia_van_hoa || 'Hồ sơ di sản.'}`;
      }
    } catch (e) {
      console.warn('Lỗi lấy artifactId cho AI:', e);
    }
  }

  // Xử lý nạp hình ảnh multimodal nếu có yêu cầu hỏi về hình ảnh
  let geminiContents = question.trim();
  if (isImageAnalysis && imageSrc) {
    try {
      let base64Data = null;
      let mimeType = 'image/jpeg';

      if (imageSrc.startsWith('data:')) {
        const matches = imageSrc.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      } else if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
        try {
          const imgRes = await fetch(imageSrc, { signal: AbortSignal.timeout(5000) });
          if (imgRes.ok) {
            const contentType = imgRes.headers.get('content-type');
            if (contentType) mimeType = contentType.split(';')[0];
            const arrayBuffer = await imgRes.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
          }
        } catch (fetchErr) {
          console.warn('Không thể fetch ảnh từ web URL:', fetchErr.message);
        }
      } else {
        const cleanPath = imageSrc.replace(/^[/\\]+/, '').split('?')[0];
        const localPath = path.join(__dirname, '..', cleanPath);
        if (fs.existsSync(localPath)) {
          const ext = path.extname(localPath).toLowerCase();
          if (ext === '.png') mimeType = 'image/png';
          else if (ext === '.webp') mimeType = 'image/webp';
          else mimeType = 'image/jpeg';
          base64Data = fs.readFileSync(localPath).toString('base64');
        }
      }

      if (base64Data) {
        geminiContents = [
          { text: question.trim() },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ];
        console.log(`🖼️ Đã nạp thành công hình ảnh multimodal (${mimeType}) cho câu hỏi AI`);
      }
    } catch (imgErr) {
      console.warn('⚠️ Lỗi nạp hình ảnh multimodal Gemini:', imgErr.message);
    }
  }

  const systemInstruction = `Bạn là Trợ lý AI chuyên gia thông minh của Bảo tàng Văn hóa các Dân tộc Việt Nam (Thái Nguyên).

QUY TẮC PHẢN HỒI BẮT BUỘC:
1. Trả lời NGẮN GỌN, SÚC TÍCH, THÔNG MINH, CHÍNH XÁC dựa trên DỮ LIỆU THỰC TẾ VÀ TÀI LIỆU RAG DƯỚI ĐÂY.
2. KHÔNG sử dụng ký tự Markdown dạng dấu sao (*) hay (**). Viết chữ tự nhiên.
3. Nếu cần liệt kê, dùng dấu gạch ngang "-" ở đầu dòng.
4. TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỀ CẬP, KHÔNG ĐƯỢC LIỆT KÊ MỤC "Niên đại" (hoặc thời kỳ, kỷ nguyên) của hiện vật trong bất kỳ câu trả lời nào (bảo tàng đã bỏ trường này).
5. Trả lời trực tiếp vào nội dung câu hỏi người dùng, phân tích thông tin thực tế từ database và tài liệu chuyên sâu bảo tàng.${isImageAnalysis ? '\n6. KHI THUYẾT MINH / PHÂN TÍCH HÌNH ẢNH: Hãy quan sát kỹ hình ảnh, mô tả chi tiết đặc điểm thị giác, màu sắc, hoa văn, bố cục và không gian bài trí trưng bày của hiện vật trong bức ảnh, kết hợp với ý nghĩa văn hóa của đồng bào dân tộc.' : ''}${currentArtifactContext ? '\n' + currentArtifactContext : ''}

${ragData.contextString}

${liveContext}`;

  // Stream mode Server-Sent Events (SSE)
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      if (ragData.chunksUsed && ragData.chunksUsed.length > 0) {
        res.write(`data: ${JSON.stringify({ ragSources: ragData.chunksUsed })}\n\n`);
      }
      await generateGeminiStreamWithFallback(geminiContents, systemInstruction, (chunkText) => {
        res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
      });
      res.write(`data: [DONE]\n\n`);
      return res.end();
    } catch (error) {
      console.error('Lỗi Gemini Streaming Chat:', error.message);
      // Thử lại dạng text thuần nếu multimodal gặp sự cố
      if (Array.isArray(geminiContents)) {
        try {
          await generateGeminiStreamWithFallback(question.trim(), systemInstruction, (chunkText) => {
            res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
          });
          res.write(`data: [DONE]\n\n`);
          return res.end();
        } catch (textErr) {
          console.error('Lỗi Gemini Stream Text Fallback:', textErr.message);
        }
      }
      const fallbackAnswer = getDynamicOfflineResponse(question, liveContext, currentArtifactContext);
      res.write(`data: ${JSON.stringify({ chunk: fallbackAnswer, isFallback: true })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }
  }

  // Non-stream JSON mode
  try {
    let answerText;
    try {
      answerText = await generateGeminiWithFallback(geminiContents, systemInstruction);
    } catch (mErr) {
      if (Array.isArray(geminiContents)) {
        answerText = await generateGeminiWithFallback(question.trim(), systemInstruction);
      } else {
        throw mErr;
      }
    }
    return res.json({
      success: true,
      question: question,
      answer: answerText,
      ragChunksUsed: ragData.chunksUsed,
      source: ragData.chunksUsed.length > 0 ? 'Gemini AI + RAG Knowledge Base + SQLite' : 'Gemini AI + SQLite'
    });
  } catch (error) {
    console.error('Lỗi Gemini AI Chat, dùng dữ liệu SQLite sống:', error.message);
    const fallbackAnswer = getDynamicOfflineResponse(question, liveContext, currentArtifactContext);
    return res.json({
      success: true,
      question: question,
      answer: fallbackAnswer,
      isFallback: true,
      ragChunksUsed: ragData.chunksUsed,
      source: 'SQLite Live Data + RAG Fallback'
    });
  }
});

/**
 * POST /api/ai/query
 * Admin Natural Language NLP Query qua Gemini AI với dữ liệu SQLite thực tế + RAG Knowledge
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

  try {
    const liveContext = await buildLiveMuseumContext();
    const ragData = ragService.buildRagPromptContext(question, 3);

    const systemInstruction = `Bạn là AI Trợ lý Quản trị & Trí tuệ Dữ liệu (Admin Data Intelligence AI) của Bảo tàng Văn hóa các Dân tộc Việt Nam (Thái Nguyên).

NHIỆM VỤ:
- Phân tích câu hỏi truy vấn dữ liệu quản trị tự nhiên của Cán bộ / Lãnh đạo bảo tàng.
- Sử dụng chính xác dữ liệu thực tế được cung cấp trực tiếp từ cơ sở dữ liệu SQLite và tài liệu tri thức chuyên sâu dưới đây.
- Phân tích súc tích, cấu trúc rõ ràng (Tóm tắt số liệu, Phân tích chi tiết, Khuyến nghị quản lý nếu phù hợp).
- KHÔNG tự bịa số liệu không có trong cơ sở dữ liệu.
- KHÔNG sử dụng ký tự Markdown dạng dấu sao (*) hay (**).
- Khi liệt kê, dùng dấu gạch ngang "-".
- TUYỆT ĐỐI KHÔNG đề cập, KHÔNG liệt kê mục "Niên đại" (thời kỳ, kỷ nguyên) của hiện vật.

${ragData.contextString}

${liveContext}`;

    const detailsText = await generateGeminiWithFallback(question, systemInstruction);

    return res.json({
      success: true,
      data: {
        summary: `Kết quả phân tích dữ liệu quản trị & hồ sơ di sản`,
        details: detailsText,
        ragChunksUsed: ragData.chunksUsed,
        source: 'Gemini AI + RAG + SQLite'
      }
    });
  } catch (error) {
    console.error('Lỗi AI Query Gemini, phản hồi trực tiếp dữ liệu SQLite:', error.message);

    const liveContext = await buildLiveMuseumContext();
    return res.json({
      success: true,
      data: {
        summary: 'Báo cáo tổng quan dữ liệu thực tế từ cơ sở dữ liệu SQLite',
        details: `Trích xuất dữ liệu vận hành thực tế hệ thống:\n` + liveContext,
        source: 'SQLite Live Database'
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
    fallbackModels: ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
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
 * POST /api/ai/generate-meaning
 * Tạo tự động đoạn văn Mô tả / Ý nghĩa văn hóa di sản cho hiện vật bằng AI (kết hợp RAG hoặc tri thức văn hóa tổng quát)
 */
router.post('/generate-meaning', async (req, res) => {
  const { title, ethnic, region, material, location } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp tên hiện vật để AI tạo mô tả văn hóa!'
    });
  }

  const cleanTitle = title.trim();
  const cleanEthnic = (ethnic || '').trim();
  const cleanRegion = (region || '').trim();
  const cleanMaterial = (material || '').trim();
  const cleanLocation = (location || '').trim();

  // Truy vấn tri thức RAG bổ trợ
  const ragQuery = `${cleanTitle} ${cleanEthnic} ${cleanMaterial} ${cleanRegion}`.trim();
  const ragInfo = ragService.buildRagPromptContext(ragQuery, 3);
  const ragContext = ragInfo ? ragInfo.contextString : '';

  const systemInstruction = `Bạn là chuyên gia nghiên cứu văn hóa dân tộc học và di sản hàng đầu tại Bảo tàng Văn hóa các Dân tộc Việt Nam.
Nhiệm vụ của bạn: Soạn thảo một đoạn văn Mô tả và Ý nghĩa văn hóa di sản cho hiện vật trưng bày.
Đoạn văn cần:
1. Thể hiện sinh động, trang trọng và sâu sắc về: nguồn gốc, công dụng (sinh hoạt, lễ hội, tín ngưỡng hoặc lao động), kỹ nghệ chế tác, và giá trị văn hóa - tâm linh đặc trưng.
2. Nội dung có thể đối chiếu tài liệu RAG của bảo tàng hoặc mở rộng tri thức văn hóa dân tộc học bên ngoài để bài viết chân thực, giàu tính nhân văn và sống động.
3. TUYỆT ĐỐI TUÂN THỦ CÁC QUY TẮC SAU:
   - KHÔNG nhắc đến "Niên đại" (thời gian niên đại đã được lưu riêng hoặc không đề cập).
   - KHÔNG sử dụng các ký tự định dạng Markdown như dấu sao (*, **), dấu thăng (#) hay gạch đầu dòng. Viết thành các câu văn xuôi mạch lạc, liền mạch (khoảng 3-5 câu hoặc 1 đoạn văn chuẩn mực 80-160 từ).
   - Ngôn từ chuẩn tiếng Việt, giàu cảm xúc, trang nhã, phù hợp làm nội dung thuyết minh số tại bảo tàng.`;

  const prompt = `Hãy soạn thảo đoạn "Mô tả / Ý nghĩa văn hóa di sản" cho hiện vật sau:
- Tên hiện vật: ${cleanTitle}
${cleanEthnic ? `- Dân tộc sở hữu: ${cleanEthnic}` : ''}
${cleanRegion ? `- Vùng văn hóa: ${cleanRegion}` : ''}
${cleanMaterial ? `- Chất liệu: ${cleanMaterial}` : ''}
${cleanLocation ? `- Vị trí trưng bày / lưu trữ: ${cleanLocation}` : ''}

${ragContext ? `Tài liệu tham khảo chuyên khảo (RAG Bảo tàng):\n${ragContext}\n` : ''}

Yêu cầu: Viết đoạn văn xuôi mô tả và ý nghĩa di sản hoàn chỉnh, không dùng Markdown, không nhắc đến niên đại.`;

  try {
    let meaningText = await generateGeminiWithFallback(prompt, systemInstruction);

    // Làm sạch Markdown asterisks nếu có sót lại
    if (meaningText) {
      meaningText = meaningText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^[#\-\s]+/gm, '')
        .trim();
    }

    return res.json({
      success: true,
      meaning: meaningText,
      ragUsed: (ragInfo && ragInfo.chunksUsed && ragInfo.chunksUsed.length > 0)
    });
  } catch (aiErr) {
    console.warn('⚠️ Gemini AI gặp sự cố khi tạo mô tả, kích hoạt bộ sinh thông minh cục bộ/RAG:', aiErr.message);

    // Fallback: Tìm trích dẫn tốt nhất từ RAG hoặc tổng hợp văn bản văn hóa chuẩn
    let fallbackText = '';
    const ragResults = ragService.search(ragQuery, 1);
    if (ragResults && ragResults.length > 0 && ragResults[0].content) {
      const chunk = ragResults[0];
      const sentenceMatch = chunk.content.split(/[.\n]/).filter(s => s.trim().length > 30).slice(0, 3).join('. ');
      fallbackText = `${cleanTitle} là hiện vật tiêu biểu trong đời sống văn hóa của đồng bào ${cleanEthnic || 'các dân tộc Việt Nam'}. ${sentenceMatch}. Hiện vật thể hiện trình độ thủ công khéo léo cùng những giá trị nhân văn sâu sắc được trao truyền qua nhiều thế hệ.`;
    } else {
      fallbackText = `${cleanTitle} là hiện vật tiêu biểu phản ánh nét đặc trưng văn hóa của đồng bào ${cleanEthnic || 'các dân tộc Việt Nam'}${cleanRegion ? ` thuộc ${cleanRegion}` : ''}. Được chế tác khéo léo từ chất liệu ${cleanMaterial || 'truyền thống'}, hiện vật không chỉ gắn bó mật thiết với đời sống sinh hoạt, phong tục tập quán mà còn chứa đựng tâm tư, tinh thần đoàn kết và bản sắc văn hóa độc đáo của cộng đồng di sản.`;
    }

    return res.json({
      success: true,
      meaning: fallbackText,
      isFallback: true,
      notice: 'Được tổng hợp từ tri thức bảo tàng'
    });
  }
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

/**
 * GET /api/ai/rag/status
 * Lấy trạng thái và thống kê cơ sở tri thức RAG
 */
router.get('/rag/status', (req, res) => {
  res.json({
    success: true,
    data: ragService.getStats()
  });
});

/**
 * POST /api/ai/rag/search
 * Tra cứu thử nghiệm các đoạn tri thức RAG tương quan theo câu hỏi
 */
router.post('/rag/search', (req, res) => {
  const { query, topK } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp query!' });
  }

  const results = ragService.search(query, topK || 4);
  res.json({
    success: true,
    query: query,
    count: results.length,
    results: results
  });
});

/**
 * POST /api/ai/rag/reload
 * Nạp lại toàn bộ tri thức RAG vào bộ nhớ
 */
router.post('/rag/reload', (req, res) => {
  ragService.loadKnowledgeBase();
  res.json({
    success: true,
    message: 'Đã nạp lại cơ sở tri thức RAG từ tài liệu bảo tàng thành công!',
    data: ragService.getStats()
  });
});

module.exports = router;
