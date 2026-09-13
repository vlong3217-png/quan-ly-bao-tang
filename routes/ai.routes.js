const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

// Khởi tạo Gemini AI Client từ API Key trong .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function calling Gemini AI with automatic model fallback for high availability
async function generateGeminiWithFallback(contents, systemInstruction) {
  const models = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
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

/**
 * POST /api/ai/chat
 * Trợ lý AI Bảo tàng trả lời câu hỏi trực tiếp qua Google Gemini API
 */
router.post('/chat', async (req, res) => {
  const { question } = req.body;

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
- Trưng bày Ngoài Trời (6 Vùng văn hóa sinh thái với kiến trúc nhà nguyên gốc & lễ hội): Vùng núi cao phía Bắc, Vùng Thung lũng, Vùng Trung du - Bắc Bộ, Vùng miền Trung - Ven biển, Vùng Trường Sơn - Tây Nguyên, Vùng Đồng Bằng Nam Bộ.`;

    const answerText = await generateGeminiWithFallback(question, systemInstruction);

    return res.json({
      success: true,
      question: question,
      answer: answerText
    });
  } catch (error) {
    console.error('Lỗi Gemini AI API Chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể kết nối với Google AI Server.'
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
        summary: `Kết quả phân tích dữ liệu quản trị thực tế qua Gemini AI`,
        details: detailsText
      }
    });
  } catch (error) {
    console.error('Lỗi Gemini AI Query:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể kết nối đến Google AI Server cho Admin.'
    });
  }
});

module.exports = router;
