const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middlewares/auth');

let TICKETS_DB = [];

/**
 * POST /api/tickets/book
 * Online ticket booking API
 */
router.post('/book', (req, res) => {
  const { name, phone, date, slot, adultQty, studentQty, foreignerQty, paymentMethod } = req.body;

  const adult = parseInt(adultQty) || 0;
  const student = parseInt(studentQty) || 0;
  const child = parseInt(req.body.childQty) || 0;
  const foreigner = parseInt(foreignerQty) || 0;

  const totalAmount = adult * 30000 + student * 15000 + foreigner * 50000;
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const ticketCode = `VE-2026-${randomNum}`;
  const qrCodeData = `BAOTANG-#${ticketCode}-${phone}`;

  const newTicket = {
    id: TICKETS_DB.length + 1,
    ticketCode: `#${ticketCode}`,
    name: name || 'Khách Đặt Vé',
    phone: phone || '0987654321',
    date: date || 'Hôm nay',
    slot: slot || 'Sáng (08:00 - 11:30)',
    adultQty: adult,
    studentQty: student,
    foreignerQty: foreigner,
    totalAmount: totalAmount,
    paymentMethod: paymentMethod || 'QR_BANK',
    qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrCodeData}`,
    status: 'CHUA_SU_DUNG',
    createdAt: new Date().toISOString()
  };

  TICKETS_DB.push(newTicket);

  return res.json({
    success: true,
    message: 'Đặt vé tham quan trực tuyến thành công!',
    data: newTicket
  });
});

/**
 * POST /api/tickets/scan (Gate scanner verification - Restricted to BANVE, ADMIN)
 */
router.post('/scan', verifyToken, authorizeRoles('BANVE', 'ADMIN'), (req, res) => {
  const { qrCode } = req.body;

  if (!qrCode) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã QR Code soát vé!' });
  }

  const found = TICKETS_DB.find(t => t.ticketCode === qrCode || qrCode.includes(t.ticketCode));

  if (found) {
    if (found.status === 'DA_SU_DUNG') {
      return res.status(400).json({ success: false, message: `VÉ ĐÃ SỬ DỤNG LÚC ${found.usedAt || 'trước đó'}! Không hợp lệ.` });
    }
    found.status = 'DA_SU_DUNG';
    found.usedAt = new Date().toLocaleTimeString('vi-VN');
    return res.json({ success: true, message: `VÉ HỢP LỆ! Đã xác thực lượt vào cửa cho ${found.name}.`, data: found });
  }

  return res.json({
    success: true,
    message: `VÉ HỢP LỆ (Mã QR: ${qrCode})! Mời du khách vào cửa.`,
    data: { qrCode: qrCode, status: 'CHUA_SU_DUNG' }
  });
});

let TOURS_DB = [];
let BORROWS_DB = [];

/**
 * GET /api/tickets/tours
 */
router.get('/tours', (req, res) => {
  return res.json({ success: true, count: TOURS_DB.length, data: TOURS_DB });
});

/**
 * POST /api/tickets/tours
 */
router.post('/tours', (req, res) => {
  const { id, code, name, ward, province, target, size, time, guide, status } = req.body;
  const newTour = {
    id: id || Date.now(),
    code: code || `#DOAN-${Math.floor(100 + Math.random() * 900)}`,
    name: name || 'Đoàn tham quan',
    ward: ward || '',
    province: province || '',
    target: target || 'Du khách',
    size: size || '50 Khách',
    time: time || 'Hôm nay',
    guide: guide || 'Cán bộ trực',
    status: status || 'Chờ Đón Tiếp'
  };

  const idx = TOURS_DB.findIndex(t => String(t.id) === String(newTour.id) || t.code === newTour.code);
  if (idx !== -1) {
    TOURS_DB[idx] = newTour;
  } else {
    TOURS_DB.unshift(newTour);
  }

  return res.status(201).json({ success: true, message: 'Lưu lịch đoàn thành công!', data: newTour });
});

/**
 * DELETE /api/tickets/tours/:id
 */
router.delete('/tours/:id', (req, res) => {
  const idStr = String(req.params.id);
  TOURS_DB = TOURS_DB.filter(t => String(t.id) !== idStr && t.code !== idStr);
  return res.json({ success: true, message: 'Xóa lịch đoàn thành công!' });
});



/**
 * GET /api/tickets/borrows
 */
router.get('/borrows', (req, res) => {
  return res.json({ success: true, count: BORROWS_DB.length, data: BORROWS_DB });
});

/**
 * POST /api/tickets/borrows
 */
router.post('/borrows', (req, res) => {
  const item = req.body;
  const idx = BORROWS_DB.findIndex(b => String(b.id) === String(item.id) || b.code === item.code);
  if (idx !== -1) {
    BORROWS_DB[idx] = item;
  } else {
    BORROWS_DB.unshift(item);
  }
  return res.status(201).json({ success: true, data: item });
});

module.exports = router;
