const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * GET /api/feedbacks
 * Lấy danh sách phản hồi (cho khách hoặc quản trị)
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit } = req.query;
    let query = 'SELECT * FROM Feedbacks';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const [rows] = await pool.query(query, params);
    return res.json({
      success: true,
      data: rows || []
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách phản hồi:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách phản hồi.'
    });
  }
});

/**
 * POST /api/feedbacks
 * Khách gửi phản hồi/đánh giá mới
 */
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, rating, category, content } = req.body;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        message: 'Họ tên và nội dung phản hồi là bắt buộc!'
      });
    }

    const numRating = parseInt(rating, 10) || 5;
    const cat = category || 'Trải nghiệm tham quan';

    const insertSql = `
      INSERT INTO Feedbacks (name, phone, email, rating, category, content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', datetime('now', 'localtime'))
    `;

    const [result] = await pool.query(insertSql, [
      name.trim(),
      (phone || '').trim(),
      (email || '').trim(),
      numRating,
      cat.trim(),
      content.trim()
    ]);

    const [newRow] = await pool.query('SELECT * FROM Feedbacks WHERE feedback_id = ?', [result.insertId]);

    return res.json({
      success: true,
      message: 'Gửi phản hồi thành công! Cảm ơn ý kiến đóng góp quý báu của quý khách.',
      data: newRow && newRow[0] ? newRow[0] : { feedback_id: result.insertId }
    });
  } catch (error) {
    console.error('Lỗi khi gửi phản hồi:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lưu phản hồi vào cơ sở dữ liệu.'
    });
  }
});

/**
 * DELETE /api/feedbacks/:id
 * Xóa phản hồi (cho Admin)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM Feedbacks WHERE feedback_id = ?', [id]);
    return res.json({
      success: true,
      message: 'Đã xóa phản hồi thành công.'
    });
  } catch (error) {
    console.error('Lỗi khi xóa phản hồi:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa phản hồi.'
    });
  }
});

module.exports = router;
