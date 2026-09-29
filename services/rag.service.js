const fs = require('fs');
const path = require('path');

class RagService {
  constructor() {
    this.chunksPath = path.join(__dirname, '../data/rag_chunks.json');
    this.chunks = [];
    this.isLoaded = false;
    this.loadKnowledgeBase();
  }

  loadKnowledgeBase() {
    try {
      if (fs.existsSync(this.chunksPath)) {
        const raw = fs.readFileSync(this.chunksPath, 'utf8');
        this.chunks = JSON.parse(raw);
        this.isLoaded = true;
        console.log(`📚 [RAG Service] Đã tải thành công ${this.chunks.length} đoạn kiến thức bảo tàng.`);
      } else {
        console.warn(`⚠️ [RAG Service] Chưa tìm thấy file ${this.chunksPath}`);
      }
    } catch (err) {
      console.error('❌ [RAG Service] Lỗi tải dữ liệu RAG:', err.message);
    }
  }

  // Chuẩn hóa từ khóa tiếng Việt (lowercase, bỏ dấu phụ tùy chọn, tách từ)
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  // Tìm kiếm các chunk liên quan nhất bằng thuật toán chấm điểm đa tầng (Title + Room + Content + Frequency)
  search(query, topK = 4) {
    if (!this.isLoaded || !this.chunks.length) {
      return [];
    }

    const cleanQuery = (query || '').trim().toLowerCase();
    const queryTokens = this.tokenize(cleanQuery);

    if (queryTokens.length === 0) {
      return [];
    }

    const scored = this.chunks.map(chunk => {
      let score = 0;
      const titleLower = chunk.title.toLowerCase();
      const roomLower = chunk.room.toLowerCase();
      const contentLower = chunk.content.toLowerCase();

      // 1. Khớp chính xác cụm từ nguyên văn trong tiêu đề hoặc nội dung
      if (cleanQuery.length > 4) {
        if (titleLower.includes(cleanQuery)) score += 50;
        if (contentLower.includes(cleanQuery)) score += 25;
      }

      // 2. Chấm điểm theo từng token từ khóa
      queryTokens.forEach(token => {
        // Khớp trong tiêu đề (trọng số cao nhất)
        if (titleLower.includes(token)) {
          score += 15;
        }

        // Khớp trong phòng/khu vực
        if (roomLower.includes(token)) {
          score += 8;
        }

        // Đếm tần suất xuất hiện trong nội dung
        let count = 0;
        let pos = contentLower.indexOf(token);
        while (pos !== -1 && count < 10) {
          count++;
          pos = contentLower.indexOf(token, pos + token.length);
        }
        score += count * 2;
      });

      return {
        ...chunk,
        score
      };
    });

    // Lọc các chunk có điểm > 0 và sắp xếp giảm dần
    const results = scored
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  // Tạo khối Context định dạng chuẩn RAG đưa vào prompt của Gemini AI
  buildRagPromptContext(query, topK = 4) {
    const matchedChunks = this.search(query, topK);

    if (!matchedChunks.length) {
      return {
        contextString: '',
        chunksUsed: []
      };
    }

    const contextParts = matchedChunks.map((c, idx) => {
      return `[TÀI LIỆU RAG #${idx + 1} - ${c.title}]\nKhu vực: ${c.room}\nNội dung chi tiết:\n${c.content}`;
    });

    const contextString = `
============================================================
TÀI LIỆU KIẾN THỨC CHUYÊN SÂU BẢO TÀNG (RAG KNOWLEDGE BASE)
(Nguồn chính thức: Hồ sơ nghiên cứu, trưng bày & hiện vật của Bảo tàng Văn hóa các Dân tộc Việt Nam)
============================================================
${contextParts.join('\n\n------------------------------------------------------------\n\n')}
============================================================
HƯỚNG DẪN DÀNH CHO TRỢ LÝ AI:
- Ưu tiên sử dụng thông tin và chi tiết chân thực từ [TÀI LIỆU RAG] ở trên để giải thích, thuyết minh và trả lời người dùng một cách chính xác, sâu sắc và đầy đủ.
- Giữ văn phong tôn trọng, tự hào văn hóa dân tộc, sinh động, dễ hiểu.
`;

    return {
      contextString,
      chunksUsed: matchedChunks.map(c => ({ id: c.id, title: c.title, room: c.room, score: c.score }))
    };
  }

  // Tổng hợp câu trả lời offline thông minh từ tài liệu RAG khi không có Internet / API
  generateOfflineRagAnswer(query) {
    const matched = this.search(query, 3);
    if (!matched.length) {
      return null;
    }

    const top = matched[0];
    const summaryExcerpt = top.content.slice(0, 450).trim() + '...';

    return `Theo tài liệu chuyên khảo của Bảo tàng Văn hóa các Dân tộc Việt Nam (${top.title}):\n\n${summaryExcerpt}\n\n(Quý khách có thể tham quan thực tế tại: ${top.room})`;
  }

  // Thống kê dữ liệu RAG
  getStats() {
    const roomCounts = {};
    this.chunks.forEach(c => {
      roomCounts[c.room] = (roomCounts[c.room] || 0) + 1;
    });

    return {
      totalChunks: this.chunks.length,
      isLoaded: this.isLoaded,
      categories: roomCounts,
      sourceDocument: 'RAG bảo tàng.docx'
    };
  }
}

const ragService = new RagService();
module.exports = ragService;
