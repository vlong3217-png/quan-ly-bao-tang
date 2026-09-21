const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middlewares/auth');

const roleNameMap = {
  ADMIN: 'Quản Trị Viên Hệ Thống',
  THUKHO: 'Cán Bộ Kiểm Kê & Thủ Kho',
  BANVE: 'Nhân Viên Bán Vé & Đón Tiếp',
  DUKHACH: 'Hội Viên Khách Tham Quan',
  KHACH: 'Hội Viên Khách Tham Quan'
};

const roleBadgeMap = {
  ADMIN: 'role-admin',
  THUKHO: 'role-thukho',
  BANVE: 'role-banve',
  DUKHACH: 'role-banve',
  KHACH: 'role-banve'
};

/**
 * GET /api/users
 * Lấy toàn bộ người dùng từ SQLite
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT user_id AS id, username, full_name AS fullName, email, phone, role, avatar FROM Users ORDER BY user_id ASC');
    const users = rows.map(u => ({
      ...u,
      roleName: roleNameMap[u.role] || 'Cán bộ',
      roleBadgeClass: roleBadgeMap[u.role] || 'role-banve'
    }));
    return res.json({ success: true, data: users });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách user:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách cán bộ!', error: error.message });
  }
});

/**
 * PUT /api/users/profile
 * Cập nhật thông tin cán bộ / người dùng trong SQLite
 */
router.put('/profile', async (req, res) => {
  try {
    const { username, fullName, email, phone, avatar, password } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tên đăng nhập!' });
    }

    const [existing] = await pool.query('SELECT * FROM Users WHERE username = ? OR email = ? LIMIT 1', [username, username]);
    if (!existing.length) {
      // If user doesn't exist yet, insert new user
      await pool.query(
        'INSERT INTO Users (username, password, full_name, email, phone, avatar) VALUES (?, ?, ?, ?, ?, ?)',
        [username, password || 'password123', fullName || username, email || '', phone || '', avatar || 'avatar/01.jpg']
      );
    } else {
      const u = existing[0];
      const newName = fullName !== undefined ? fullName : u.full_name;
      const newEmail = email !== undefined ? email : u.email;
      const newPhone = phone !== undefined ? phone : u.phone;
      const newAvatar = avatar !== undefined ? avatar : u.avatar;
      const newPassword = password !== undefined ? password : u.password;

      await pool.query(
        'UPDATE Users SET full_name = ?, email = ?, phone = ?, avatar = ?, password = ? WHERE user_id = ?',
        [newName, newEmail, newPhone, newAvatar, newPassword, u.user_id]
      );
    }

    const [updatedRows] = await pool.query('SELECT * FROM Users WHERE username = ? OR email = ? LIMIT 1', [username, username]);
    const updatedUser = updatedRows[0];

    return res.json({
      success: true,
      message: 'Cập nhật thông tin cán bộ vào cơ sở dữ liệu SQLite thành công!',
      data: {
        id: updatedUser.user_id,
        username: updatedUser.username,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        roleName: roleNameMap[updatedUser.role] || 'Cán bộ',
        avatar: updatedUser.avatar
      }
    });

  } catch (error) {
    console.error('❌ Lỗi cập nhật thông tin user:', error);
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật thông tin cán bộ!', error: error.message });
  }
});

/**
 * POST /api/users
 * Tạo mới tài khoản cán bộ vào SQLite
 */
router.post('/', async (req, res) => {
  try {
    const { fullName, username, email, phone, role, password } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tên đăng nhập!' });
    }

    const userRole = role || 'BANVE';

    const [result] = await pool.query(
      'INSERT INTO Users (username, password, full_name, email, phone, role, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, password || 'password123', fullName || username, email || '', phone || '', userRole, 'avatar/01.jpg']
    );

    const newUser = {
      id: result.insertId,
      fullName: fullName || username,
      username: username,
      email: email,
      phone: phone,
      role: userRole,
      roleName: roleNameMap[userRole] || 'Cán bộ',
      isLocked: false
    };

    return res.status(201).json({
      success: true,
      message: `Đã tạo tài khoản cán bộ ${fullName || username} vào SQLite thành công!`,
      data: newUser
    });

  } catch (error) {
    console.error('❌ Lỗi tạo user:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tạo tài khoản cán bộ!', error: error.message });
  }
});

/**
 * PUT /api/users/:id
 * Cập nhật thông tin cán bộ theo ID trong SQLite
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullName, username, email, phone, role, password } = req.body;

    const [existing] = await pool.query('SELECT * FROM Users WHERE user_id = ? OR username = ? LIMIT 1', [userId, username]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản cán bộ!' });
    }

    const u = existing[0];
    const newName = fullName !== undefined ? fullName : u.full_name;
    const newEmail = email !== undefined ? email : u.email;
    const newPhone = phone !== undefined ? phone : u.phone;
    const newRole = role !== undefined ? role : u.role;
    const newPassword = password ? password : u.password;

    await pool.query(
      'UPDATE Users SET full_name = ?, email = ?, phone = ?, role = ?, password = ? WHERE user_id = ?',
      [newName, newEmail, newPhone, newRole, newPassword, u.user_id]
    );

    const [updatedRows] = await pool.query('SELECT * FROM Users WHERE user_id = ?', [u.user_id]);
    const updatedUser = updatedRows[0];

    return res.json({
      success: true,
      message: 'Cập nhật thông tin cán bộ thành công!',
      data: {
        id: updatedUser.user_id,
        username: updatedUser.username,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        roleName: roleNameMap[updatedUser.role] || 'Cán bộ',
        isLocked: false
      }
    });

  } catch (error) {
    console.error('❌ Lỗi cập nhật user:', error);
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật tài khoản cán bộ!', error: error.message });
  }
});

module.exports = router;
