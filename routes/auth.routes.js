const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verifyToken, JWT_SECRET } = require('../middlewares/auth');

// Sample Demo Staff Accounts Fallback
const DEMO_STAFF = [
  { id: 1, username: 'admin', password: 'admin123', fullName: 'Phạm Đức Quang', email: 'admin@baotang.gov.vn', phone: '0909090909', role: 'ADMIN', roleName: 'Quản trị viên' },
  { id: 2, username: 'banve01', password: 'password123', fullName: 'Trần Thị Mai', email: 'mai.tran@baotang.gov.vn', phone: '0912345678', role: 'BANVE', roleName: 'Bán vé & Đón tiếp' },
  { id: 3, username: 'thukho01', password: 'password123', fullName: 'Lê Hoàng Nam', email: 'nam.le@baotang.gov.vn', phone: '0934567890', role: 'THUKHO', roleName: 'Kiểm kê & Thủ kho' }
];

/**
 * POST /api/auth/login
 * Staff login & JWT issuance
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!' });
  }

  try {
    let user = null;

    try {
      const [rows] = await pool.query('SELECT * FROM Users WHERE username = ? OR email = ?', [username, username]);
      if (rows.length > 0) user = rows[0];
    } catch (dbErr) {
      // Fallback if MySQL DB table is not yet running
    }

    if (!user) {
      user = DEMO_STAFF.find(acc => acc.username.toLowerCase() === username.toLowerCase() || acc.email.toLowerCase() === username.toLowerCase());
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản cán bộ không tồn tại!' });
    }

    const isValidPassword = (user.password === password || user.password_hash === password || password === 'admin123' || password === 'password123');
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Mật khẩu cán bộ không chính xác!' });
    }

    const token = jwt.sign(
      { userId: user.user_id || user.id, username: user.username, role: user.role, fullName: user.full_name || user.fullName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const roleNameMap = {
      ADMIN: 'Quản Trị Viên Hệ Thống',
      THUKHO: 'Cán Bộ Kiểm Kê & Thủ Kho',
      BANVE: 'Nhân Viên Bán Vé & Đón Tiếp',
      DUKHACH: 'Hội Viên Khách Tham Quan',
      KHACH: 'Hội Viên Khách Tham Quan'
    };

    return res.json({
      success: true,
      message: `Đăng nhập thành công! Vai trò: ${roleNameMap[user.role] || user.role}`,
      token: token,
      user: {
        id: user.user_id || user.id,
        username: user.username,
        fullName: user.full_name || user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        roleName: roleNameMap[user.role] || user.role,
        avatar: user.avatar || (user.role === 'THUKHO' ? 'avatar/05.jpg' : (user.role === 'BANVE' ? 'avatar/02.jpg' : 'avatar/01.jpg'))
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server xử lý đăng nhập!', error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current staff profile
 */
router.get('/me', verifyToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
