/* ============================================================
   BẢO TÀNG VĂN HÓA CÁC DÂN TỘC VIỆT NĂM - FRONTEND CONTROLLER
   Trọn Bộ 21 Màn Hình Giao Diện (UI-01 đến UI-21)
   ============================================================ */

// Sample Heritage Artifacts Database (54 Ethnic Groups Collection)
let ARTIFACTS_DATA = [];

// Sample Borrow Tickets Database (UI-16)
let BORROW_DATA = [];
let TOURS_DATA = [];
let RESTORATION_DATA = [];
let TICKETS_PURCHASED_DATA = [];

// Sample Staff User Accounts Table Database
let USERS_DATA = [
  { id: 1, fullName: 'Phạm Đức Quang', username: 'admin', email: 'admin@baotang.gov.vn', phone: '0909090909', role: 'ADMIN', roleName: 'Quản trị viên', isLocked: false },
  { id: 2, fullName: 'Trần Thị Mai', username: 'banve01', email: 'mai.tran@baotang.gov.vn', phone: '0912345678', role: 'BANVE', roleName: 'Bán vé & Đón tiếp', isLocked: false },
  { id: 3, fullName: 'Lê Hoàng Nam', username: 'thukho01', email: 'nam.le@baotang.gov.vn', phone: '0934567890', role: 'THUKHO', roleName: 'Kiểm kê & Thủ kho', isLocked: false }
];

// Demo Accounts Mapping for Internal Staff Roles
const DEMO_ACCOUNTS = {
  BANVE: {
    username: 'banve01',
    password: 'password123',
    fullName: 'Trần Thị Mai',
    email: 'mai.tran@baotang.gov.vn',
    phone: '0912 345 678',
    role: 'BANVE',
    roleName: 'Nhân Viên Bán Vé & Đón Tiếp',
    roleBadgeClass: 'role-banve',
    roleDesc: 'Quyền Hạn: Bán vé tại quầy (POS), Soát vé vào cửa (QR Scan), Quản lý lịch đoàn tham quan'
  },
  THUKHO: {
    username: 'thukho01',
    password: 'password123',
    fullName: 'Lê Hoàng Nam',
    email: 'nam.le@baotang.gov.vn',
    phone: '0934 567 890',
    role: 'THUKHO',
    roleName: 'Cán Bộ Kiểm Kê & Thủ Kho',
    roleBadgeClass: 'role-thukho',
    roleDesc: 'Quyền Hạn: Quản lý hồ sơ hiện vật, Luân chuyển vị trí kho/trưng bày, Mượn/trả & bảo quản di sản'
  },
  ADMIN: {
    username: 'admin',
    password: 'admin123',
    fullName: 'Phạm Đức Quang',
    email: 'admin@baotang.gov.vn',
    phone: '0909 090 909',
    role: 'ADMIN',
    roleName: 'Quản Trị Viên Hệ Thống',
    roleBadgeClass: 'role-admin',
    roleDesc: 'Quyền Hạn: Quyền Quản trị cao nhất (Quản lý User, Cấu hình danh mục, Xem báo cáo tổng quan)'
  }
};

const API_BASE = '/api';

let currentArtifact = ARTIFACTS_DATA[0];
let isPlayingAudio = false;
let speechSynth = window.speechSynthesis;
let currentUser = null;
let posCartTotal = 30000;

/**
 * Helper to normalize and sanitize artifact objects from LocalStorage or Backend API
 */
function normalizeArtifact(art) {
  if (!art || typeof art !== 'object') return null;

  const code = art.code || art.ma_hien_vat || art.MaHienVat || (art.id ? `HV-00${art.id}` : null);
  const title = art.title || art.ten_hien_vat || art.TenHienVat || art.ten || null;
  const ethnic = art.ethnic || art.dan_toc || art.DanToc || 'Đang cập nhật';
  const region = art.region || art.vung_van_hoa || art.VungVanHoa || 'Vùng núi cao phía Bắc';
  const material = art.material || art.chat_lieu || art.ChatLieu || 'Đang cập nhật';
  const location = art.location || art.vi_tri_kho || art.ViTriKho || 'Kho Bảo Quản 1';
  const status = art.status || art.tinh_trang || art.TinhTrang || 'Nguyên vẹn';
  const era = art.era || art.nien_dai || art.NienDai || 'Thế kỷ XX';
  const img = art.img || art.hinh_anh || art.HinhAnh || (art.images && art.images[0]) || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80';
  const images = (art.images && art.images.length > 0) ? art.images : [img];

  // Ignore corrupted objects where both code and title are literal 'undefined' or missing
  if ((!code || code === 'undefined') && (!title || title === 'undefined')) {
    return null;
  }

  return {
    id: art.id || Date.now(),
    code: (code && code !== 'undefined') ? code : `HV-${art.id || 1}`,
    title: (title && title !== 'undefined') ? title : 'Hiện vật di sản',
    ethnic: (ethnic && ethnic !== 'undefined') ? ethnic : 'Đang cập nhật',
    region: (region && region !== 'undefined') ? region : 'Vùng núi cao phía Bắc',
    material: (material && material !== 'undefined') ? material : 'Đang cập nhật',
    location: (location && location !== 'undefined') ? location : 'Kho Bảo Quản 1',
    status: (status && status !== 'undefined') ? status : 'Nguyên vẹn',
    era: (era && era !== 'undefined') ? era : 'Thế kỷ XX',
    img: img,
    images: images,
    meaning: art.meaning || 'Hồ sơ di sản được bổ sung vào hệ thống kiểm kê kho.',
    audioText: art.audioText || `Hiện vật ${title || 'di sản'} của Dân tộc ${ethnic || 'Đang cập nhật'}.`
  };
}

// Initialize Page Logics & Fetch Backend API Data
document.addEventListener('DOMContentLoaded', async () => {
  // Load persistent local storage data if user added items previously
  const savedArtifacts = localStorage.getItem('baotang_artifacts_data');
  if (savedArtifacts) {
    try {
      const parsed = JSON.parse(savedArtifacts);
      if (Array.isArray(parsed)) {
        ARTIFACTS_DATA = parsed.map(normalizeArtifact).filter(Boolean);
        localStorage.setItem('baotang_artifacts_data', JSON.stringify(ARTIFACTS_DATA));
      }
    } catch (e) {}
  }
  const savedTours = localStorage.getItem('baotang_tours_data');
  if (savedTours) {
    try { TOURS_DATA = JSON.parse(savedTours); } catch (e) {}
  }
  const savedBorrows = localStorage.getItem('baotang_borrow_data');
  if (savedBorrows) {
    try { BORROW_DATA = JSON.parse(savedBorrows); } catch (e) {}
  }
  const savedTickets = localStorage.getItem('baotang_purchased_tickets_data');
  if (savedTickets) {
    try { TICKETS_PURCHASED_DATA = JSON.parse(savedTickets); } catch (e) {}
  }

  renderCatalog(ARTIFACTS_DATA);
  renderInventoryTable(ARTIFACTS_DATA);
  renderBorrowTable(BORROW_DATA);
  renderTourTable(TOURS_DATA);
  renderRestorationTable(RESTORATION_DATA);
  renderUserTable(USERS_DATA);
  renderDashboardStats();
  
  const todayStr = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('bookingDate');
  if (dateInput) dateInput.value = todayStr;

  const savedUser = localStorage.getItem('baotang_staff_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    renderProfileView(currentUser);
    document.getElementById('headerProfileBtn').style.display = 'inline-flex';
    document.getElementById('navLoginBtn').style.display = 'none';
  }
  updateNavigationVisibility(currentUser);

  // Sync with live Node.js REST API Backend for real-time multi-device synchronization
  try {
    const [resArt, resTour, resBorrow] = await Promise.all([
      fetch(`${API_BASE}/artifacts`),
      fetch(`${API_BASE}/tickets/tours`),
      fetch(`${API_BASE}/tickets/borrows`)
    ]);

    if (resArt.ok) {
      const result = await resArt.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const backendArtifacts = result.data.map(normalizeArtifact).filter(Boolean);
        if (backendArtifacts.length > 0) {
          ARTIFACTS_DATA = backendArtifacts;
          localStorage.setItem('baotang_artifacts_data', JSON.stringify(ARTIFACTS_DATA));
        }
      }
    }

    if (resTour.ok) {
      const tourResult = await resTour.json();
      if (tourResult.success && Array.isArray(tourResult.data) && tourResult.data.length > 0) {
        TOURS_DATA = tourResult.data;
        localStorage.setItem('baotang_tours_data', JSON.stringify(TOURS_DATA));
      }
    }

    if (resBorrow && resBorrow.ok) {
      const borrowResult = await resBorrow.json();
      if (borrowResult.success && Array.isArray(borrowResult.data) && borrowResult.data.length > 0) {
        BORROW_DATA = borrowResult.data;
        localStorage.setItem('baotang_borrow_data', JSON.stringify(BORROW_DATA));
      }
    }
  } catch (apiErr) {
    console.log('📡 Using local dataset fallback for museum data.');
  }

  renderCatalog(ARTIFACTS_DATA);
  renderInventoryTable(ARTIFACTS_DATA);
  renderBorrowTable(BORROW_DATA);
  renderTourTable(TOURS_DATA);
  renderDashboardStats();
  renderShiftReportStats();
});

/**
 * Update Header Navigation Visibility based on Staff Role
 */
function updateNavigationVisibility(user) {
  const staffLinks = document.querySelectorAll('.nav-staff-thukho, .nav-staff-banve, .nav-staff-admin');
  staffLinks.forEach(link => link.style.display = 'none');

  if (!user) return; // Public Visitor mode

  if (user.role === 'THUKHO') {
    document.querySelectorAll('.nav-staff-thukho').forEach(link => link.style.display = 'inline-flex');
  } else if (user.role === 'BANVE') {
    document.querySelectorAll('.nav-staff-banve').forEach(link => link.style.display = 'inline-flex');
  } else if (user.role === 'ADMIN') {
    document.querySelectorAll('.nav-staff-thukho, .nav-staff-banve, .nav-staff-admin').forEach(link => link.style.display = 'inline-flex');
  }
}

/**
 * Switch Navigation views (Trọn bộ UI-01 đến UI-21)
 */
function switchNav(viewId) {
  const views = document.querySelectorAll('.screen-view');
  views.forEach(v => v.classList.remove('active'));

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  const navLinks = document.querySelectorAll('.main-nav .nav-link');
  navLinks.forEach(link => link.classList.remove('active'));

  const linkMap = {
    viewHome: 'navHome',
    viewCatalog: 'navCatalog',
    viewBooking: 'navBooking',
    viewMyTickets: 'navMyTickets',
    viewArtifactInventory: 'navInventory',
    viewStorageTransfer: 'navTransfer',
    viewBorrowReturn: 'navBorrow',
    viewRestorationLogs: 'navRestoration',
    viewPosTicket: 'navPos',
    viewGateScanner: 'navScanner',
    viewTourSchedule: 'navTour',
    viewShiftReport: 'navShift',
    viewAdminDashboard: 'navAdminDashboard',
    viewUserManagement: 'navUserManagement',
    viewCategoryManagement: 'navCategoryManagement',
    viewAdminAiAssistant: 'navAdminAi'
  };

  if (linkMap[viewId]) {
    const activeLink = document.getElementById(linkMap[viewId]);
    if (activeLink) activeLink.classList.add('active');
  }

  if (viewId === 'viewAdminDashboard') {
    renderDashboardStats();
  }

  if (viewId === 'viewShiftReport') {
    const elStaffName = document.getElementById('shiftStaffName');
    if (elStaffName && typeof currentUser !== 'undefined' && currentUser && currentUser.full_name) {
      elStaffName.textContent = currentUser.full_name;
    }
    renderShiftReportStats();
  }

  if (viewId === 'viewCategoryManagement') {
    renderCategoryTicketPricesTable();
    renderCategoryEthnicitiesTable();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDashboardStats() {
  const elVisitors = document.getElementById('kpiTotalVisitors');
  const elRevenue = document.getElementById('kpiTotalRevenue');
  const elArtifacts = document.getElementById('kpiTotalArtifacts');
  const elUsers = document.getElementById('kpiTotalUsers');

  let totalVisitors = 0;
  let totalRevenue = 0;
  let adultRevenue = 0;
  let childCount = 0;

  (TICKETS_PURCHASED_DATA || []).forEach(t => {
    totalVisitors += (t.totalQty || t.adultQty + t.childQty || 1);
    totalRevenue += (t.amount || 0);
    adultRevenue += (t.adultQty || 0) * 30000;
    childCount += (t.childQty || 0);
  });

  if (elVisitors) elVisitors.textContent = totalVisitors;
  if (elRevenue) elRevenue.textContent = totalRevenue.toLocaleString('vi-VN') + ' VNĐ';
  if (elArtifacts) elArtifacts.textContent = (ARTIFACTS_DATA || []).length;
  if (elUsers) elUsers.textContent = (USERS_DATA || []).length;

  // Render Tỷ Lệ Loại Vé
  const elAdultDisplay = document.getElementById('kpiAdultRevenueDisplay');
  const elAdultBar = document.getElementById('kpiAdultBar');
  const elChildDisplay = document.getElementById('kpiChildRevenueDisplay');
  const elChildBar = document.getElementById('kpiChildBar');

  const totalTickets = (TICKETS_PURCHASED_DATA || []).reduce((acc, t) => acc + (t.totalQty || 1), 0);
  if (totalTickets > 0) {
    const adultQtyTotal = (TICKETS_PURCHASED_DATA || []).reduce((acc, t) => acc + (t.adultQty || 0), 0);
    const adultPercent = Math.round((adultQtyTotal / totalTickets) * 100);
    const childPercent = Math.round((childCount / totalTickets) * 100);

    if (elAdultDisplay) elAdultDisplay.textContent = `${adultRevenue.toLocaleString('vi-VN')} VNĐ (${adultPercent}%)`;
    if (elAdultBar) elAdultBar.style.width = `${adultPercent}%`;

    if (elChildDisplay) elChildDisplay.textContent = `${childCount} Vé (${childPercent}%)`;
    if (elChildBar) elChildBar.style.width = `${childPercent}%`;
  } else {
    if (elAdultDisplay) elAdultDisplay.textContent = '0 VNĐ (0%)';
    if (elAdultBar) elAdultBar.style.width = '0%';
    if (elChildDisplay) elChildDisplay.textContent = '0 VNĐ (0%)';
    if (elChildBar) elChildBar.style.width = '0%';
  }
}

/**
 * Render real-time Shift Report stats (UI-21)
 */
function renderShiftReportStats() {
  const elTicketCount = document.getElementById('shiftTicketCount');
  const elCashRev = document.getElementById('shiftCashRevenue');
  const elQrRev = document.getElementById('shiftQrRevenue');
  const elTotalRev = document.getElementById('shiftTotalRevenue');

  let totalTickets = 0;
  let cashRevenue = 0;
  let qrRevenue = 0;

  (TICKETS_PURCHASED_DATA || []).forEach(t => {
    totalTickets += (t.totalQty || 1);
    if (t.type === 'POS' || t.paymentMethod === 'Tiền mặt thu tại quầy') {
      cashRevenue += (t.amount || 0);
    } else {
      qrRevenue += (t.amount || 0);
    }
  });

  const totalRevenue = cashRevenue + qrRevenue;

  if (elTicketCount) elTicketCount.textContent = `${totalTickets} Vé`;
  if (elCashRev) elCashRev.textContent = `${cashRevenue.toLocaleString('vi-VN')} VNĐ`;
  if (elQrRev) elQrRev.textContent = `${qrRevenue.toLocaleString('vi-VN')} VNĐ`;
  if (elTotalRev) elTotalRev.textContent = `${totalRevenue.toLocaleString('vi-VN')} VNĐ`;
}

/**
 * UI-05: Render & Filter Catalog Cards
 */
function renderCatalog(artifacts) {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  const validArtifacts = (artifacts || []).map(normalizeArtifact).filter(Boolean);

  if (validArtifacts.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3.5rem 1.5rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <i class="fa-solid fa-boxes-packing" style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary-gold); display: block;"></i>
        <strong style="font-size: 1.15rem; color: var(--text-primary);">Chưa có dữ liệu di sản / dân tộc nào được khởi tạo.</strong>
        <p style="font-size: 0.9rem; margin-top: 0.5rem; color: var(--text-muted);">Cán bộ có thể nhập hồ sơ di sản mới tại màn hình <strong>Kho Di Sản</strong> (UI-13).</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = validArtifacts.map(art => `
    <div class="artifact-card">
      <div class="artifact-img-box">
        <img src="${art.img}" alt="${art.title}" class="artifact-img">
        <span class="artifact-code-badge">${art.code}</span>
      </div>
      <div class="artifact-body">
        <span class="artifact-ethno-tag">${art.ethnic} • ${art.region}</span>
        <h3 class="artifact-title">${art.title}</h3>
        <div class="artifact-meta">
          <div><i class="fa-solid fa-gem"></i> Chất liệu: ${art.material}</div>
          <div><i class="fa-solid fa-location-dot"></i> Vị trí: ${art.location}</div>
        </div>
        <button type="button" class="artifact-btn" onclick="openArtifactDetail('${art.id}')">
          <i class="fa-solid fa-headphones"></i> Chi Tiết & AI Audio
        </button>
      </div>
    </div>
  `).join('');
}

function filterCatalog() {
  const searchVal = document.getElementById('catalogSearchInput').value.toLowerCase().trim();
  const regionVal = document.getElementById('filterRegionSelect').value;
  const langVal = document.getElementById('filterLanguageSelect').value;

  const filtered = ARTIFACTS_DATA.filter(art => {
    const matchSearch = art.title.toLowerCase().includes(searchVal) || art.ethnic.toLowerCase().includes(searchVal) || art.code.toLowerCase().includes(searchVal);
    const matchRegion = !regionVal || art.region === regionVal;
    const matchLang = !langVal || art.languageGroup === langVal;
    return matchSearch && matchRegion && matchLang;
  });

  renderCatalog(filtered);
}

/**
 * UI-06: Open Artifact Detail View & Load AI Data
 */
function openArtifactDetail(id) {
  const art = ARTIFACTS_DATA.find(item => String(item.id) === String(id) || item.code === String(id));
  if (!art) {
    showToast('Chưa có thông tin chi tiết hiện vật này.', 'info');
    return;
  }
  currentArtifact = art;

  const images = (art.images && art.images.length > 0) ? art.images : [art.img];
  document.getElementById('detailImg').src = images[0] || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80';
  
  // Render thumbnail gallery strip if multiple images exist
  const strip = document.getElementById('detailGalleryStrip');
  if (strip) {
    if (images.length > 1) {
      strip.style.display = 'flex';
      strip.innerHTML = images.map((src, idx) => `
        <div class="detail-thumb-item ${idx === 0 ? 'active' : ''}" onclick="switchDetailImage('${src}', this)">
          <img src="${src}" alt="Hình ảnh ${idx + 1}">
        </div>
      `).join('');
    } else {
      strip.style.display = 'none';
      strip.innerHTML = '';
    }
  }

  document.getElementById('detailCode').textContent = art.code;
  document.getElementById('detailEthno').textContent = art.ethnic;
  document.getElementById('detailRegion').textContent = art.region;
  const elEra = document.getElementById('detailEra');
  if (elEra) elEra.textContent = art.era || '';
  document.getElementById('detailMaterial').textContent = art.material;
  document.getElementById('detailLocation').textContent = art.location;
  document.getElementById('detailTitle').textContent = art.title;
  document.getElementById('detailMeaning').textContent = art.meaning;
  document.getElementById('audioTranscript').textContent = art.audioText;

  stopAudioSpeech();

  document.getElementById('chatMessages').innerHTML = `
    <div class="msg-bubble msg-ai">
      Xin chào! Tôi là Trợ lý AI Bảo tàng. Bạn có thắc mắc gì về ý nghĩa hoa văn hay lịch sử của hiện vật <strong>${art.title}</strong> không?
    </div>
  `;

  switchNav('viewArtifactDetail');
}

function switchDetailImage(src, thumbElem) {
  const detailImg = document.getElementById('detailImg');
  if (detailImg) {
    detailImg.style.opacity = '0.4';
    setTimeout(() => {
      detailImg.src = src;
      detailImg.style.opacity = '1';
    }, 150);
  }
  const thumbs = document.querySelectorAll('.detail-thumb-item');
  thumbs.forEach(t => t.classList.remove('active'));
  if (thumbElem) thumbElem.classList.add('active');
}

function togglePlayAudio() {
  if (isPlayingAudio) {
    stopAudioSpeech();
  } else {
    playAudioSpeech();
  }
}

function playAudioSpeech() {
  if (!currentArtifact) return;

  if (speechSynth && 'SpeechSynthesisUtterance' in window) {
    speechSynth.cancel();
    const utterance = new SpeechSynthesisUtterance(currentArtifact.audioText);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;

    utterance.onend = () => stopAudioSpeech();
    utterance.onerror = () => stopAudioSpeech();

    speechSynth.speak(utterance);
  }

  isPlayingAudio = true;
  document.getElementById('audioPlayIcon').className = 'fa-solid fa-pause';
  document.getElementById('audioBar').style.width = '100%';
  document.getElementById('audioBar').style.transition = 'width 12s linear';
  showToast('Đang phát AI thuyết minh tự động...', 'info');
}

function stopAudioSpeech() {
  if (speechSynth) speechSynth.cancel();
  isPlayingAudio = false;
  const playIcon = document.getElementById('audioPlayIcon');
  if (playIcon) playIcon.className = 'fa-solid fa-play';
  const bar = document.getElementById('audioBar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '0%';
  }
}

/**
 * Utility: Convert Markdown to clean HTML and strip asterisks
 */
function formatAiText(text) {
  if (!text) return '';
  let formatted = text
    // Replace **bold** with <strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Replace *italic* with <em>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Replace bullet points starting with * or - with a clean dot
    .replace(/^\s*[\*\-]\s+/gm, '• ')
    // Replace double newlines with spacing, single with br
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');

  // Strip any remaining loose asterisks
  return formatted.replace(/\*/g, '');
}

async function handleSendAiChat(event) {
  event.preventDefault();
  const input = document.getElementById('chatInput');
  const userMsg = input.value.trim();
  if (!userMsg) return;

  const chatMessages = document.getElementById('chatMessages');

  const userBubble = document.createElement('div');
  userBubble.className = 'msg-bubble msg-user';
  userBubble.textContent = userMsg;
  chatMessages.appendChild(userBubble);
  input.value = '';

  chatMessages.scrollTop = chatMessages.scrollHeight;

  const aiBubble = document.createElement('div');
  aiBubble.className = 'msg-bubble msg-ai';
  aiBubble.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Trợ lý AI đang suy nghĩ...';
  chatMessages.appendChild(aiBubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: userMsg,
        artifactId: currentArtifact ? currentArtifact.id : null
      })
    });
    const data = await res.json();
    if (data.success) {
      aiBubble.innerHTML = formatAiText(data.answer);
    } else {
      aiBubble.innerHTML = data.message || 'Có lỗi xảy ra khi kết nối Trợ lý AI.';
    }
  } catch (err) {
    console.error('Lỗi AI Chat:', err);
    aiBubble.innerHTML = 'Không thể kết nối với Server AI.';
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * UI-13 & UI-14: Inventory & Artifact Modal Handlers
 */
function renderInventoryTable(artifacts) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  const validArtifacts = (artifacts || []).map(normalizeArtifact).filter(Boolean);

  if (validArtifacts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          <i class="fa-solid fa-boxes-stacked" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--primary-gold); display: block;"></i>
          <strong>Chưa có hồ sơ hiện vật di sản nào trong kho lưu trữ.</strong>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Nhấn nút "Thêm Hồ Sơ Hiện Vật" phía trên để nhập dữ liệu di sản.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = validArtifacts.map(art => `
    <tr>
      <td><strong>${art.code}</strong></td>
      <td><strong>${art.title}</strong></td>
      <td>${art.ethnic}</td>
      <td>${art.location}</td>
      <td>
        <span class="badge-status ${art.status === 'Nguyên vẹn' ? 'badge-success' : 'badge-warning'}">${art.status}</span>
      </td>
      <td style="display: flex; gap: 0.5rem; align-items: center;">
        <button type="button" class="btn-secondary btn-sm" onclick="openArtifactModal('${art.id}')"><i class="fa-solid fa-pen"></i> Sửa</button>
        <button type="button" class="btn-danger btn-sm" onclick="deleteArtifact('${art.id}')"><i class="fa-solid fa-trash-can"></i> Xóa</button>
      </td>
    </tr>
  `).join('');
}

function filterInventory() {
  const query = document.getElementById('inventorySearchInput').value.toLowerCase().trim();
  const locVal = document.getElementById('filterInventoryLoc').value;

  const filtered = ARTIFACTS_DATA.filter(art => {
    const matchQ = art.code.toLowerCase().includes(query) || art.title.toLowerCase().includes(query) || art.ethnic.toLowerCase().includes(query);
    const matchLoc = !locVal || art.location === locVal;
    return matchQ && matchLoc;
  });

  renderInventoryTable(filtered);
}

let editingArtifactId = null;
let editingArtifactImages = [];

function renderModalGallery() {
  const container = document.getElementById('modalArtGalleryContainer');
  const badge = document.getElementById('modalArtImgCountBadge');
  if (badge) badge.textContent = `${editingArtifactImages.length} ảnh`;

  if (!container) return;

  if (editingArtifactImages.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; font-size: 0.825rem; color: var(--text-muted); padding: 0.75rem 0; border: 1.5px dashed var(--border-gold); border-radius: var(--radius-sm); background: rgba(255,255,255,0.5);">
        <i class="fa-regular fa-images" style="font-size: 1.5rem; display: block; margin-bottom: 0.25rem; color: var(--primary-gold);"></i>
        Chưa có ảnh di sản nào. Chọn file từ máy tính, dán URL hoặc nhấn <strong>Ctrl + V</strong> để dán ảnh.
      </div>
    `;
    return;
  }

  container.innerHTML = editingArtifactImages.map((src, index) => `
    <div class="gallery-thumb-card ${index === 0 ? 'is-cover' : ''}" onclick="setCoverArtifactImage(${index})" title="${index === 0 ? 'Ảnh bìa chính' : 'Bấm để chọn làm ảnh chính'}">
      <img src="${src}" alt="Ảnh ${index + 1}" class="gallery-thumb-img" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80';">
      ${index === 0 ? '<span class="gallery-thumb-cover-badge">Ảnh chính</span>' : ''}
      <button type="button" class="gallery-thumb-remove-btn" onclick="event.stopPropagation(); removeArtifactImage(${index})" title="Xóa ảnh này">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `).join('');
}

/**
 * Canvas Image Compression Helper to prevent LocalStorage Quota Exceeded and payload size errors
 */
function compressImage(base64Str, maxWidth = 1000, quality = 0.82) {
  return new Promise((resolve) => {
    if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
}

function setCoverArtifactImage(index) {
  if (index === 0 || index >= editingArtifactImages.length) return;
  const selected = editingArtifactImages.splice(index, 1)[0];
  editingArtifactImages.unshift(selected);
  renderModalGallery();
  showToast('Đã chọn ảnh làm ảnh bìa chính!', 'info');
}

function removeArtifactImage(index) {
  editingArtifactImages.splice(index, 1);
  renderModalGallery();
}

async function addArtifactImages(sources) {
  if (!Array.isArray(sources)) sources = [sources];
  for (let src of sources) {
    let cleanSrc = (src || '').trim();
    if (!cleanSrc) continue;
    if (cleanSrc.startsWith('www.')) cleanSrc = 'https://' + cleanSrc;

    // Auto-compress high-res uploaded base64 image files
    if (cleanSrc.startsWith('data:image/')) {
      cleanSrc = await compressImage(cleanSrc);
    }

    if (!editingArtifactImages.includes(cleanSrc)) {
      editingArtifactImages.push(cleanSrc);
    }
  }
  renderModalGallery();
}

function handleImageFileSelect(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = async function(e) {
      await addArtifactImages(e.target.result);
      loaded++;
      if (loaded === files.length) {
        showToast(`Đã tải & tối ưu ${files.length} ảnh từ máy tính!`, 'success');
      }
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function handleAddUrlImage() {
  const input = document.getElementById('modalArtImgUrl');
  let url = input ? input.value.trim() : '';
  if (!url) {
    showToast('Vui lòng nhập hoặc dán đường dẫn URL ảnh.', 'warning');
    return;
  }
  if (url.startsWith('www.')) url = 'https://' + url;
  addArtifactImages(url);
  input.value = '';
  showToast('Đã thêm ảnh từ đường dẫn URL!', 'success');
}

function openArtifactModal(id = null) {
  editingArtifactId = (id !== null && id !== undefined && id !== '') ? id : null;
  const modal = document.getElementById('artifactModal');
  const fileInput = document.getElementById('modalArtFileInput');
  if (fileInput) fileInput.value = '';

  if (editingArtifactId !== null) {
    const art = ARTIFACTS_DATA.find(item => String(item.id) === String(editingArtifactId) || item.code === String(editingArtifactId));
    if (art) {
      document.getElementById('modalArtCode').value = art.code || '';
      document.getElementById('modalArtTitle').value = art.title || '';
      document.getElementById('modalArtEthnic').value = art.ethnic || '';
      document.getElementById('modalArtRegion').value = art.region || 'Vùng núi cao phía Bắc';
      document.getElementById('modalArtMaterial').value = art.material || '';
      document.getElementById('modalArtLocation').value = art.location || 'Kho Bảo Quản 1';
      document.getElementById('modalArtImgUrl').value = '';
      
      if (art.images && art.images.length > 0) {
        editingArtifactImages = [...art.images];
      } else if (art.img) {
        editingArtifactImages = [art.img];
      } else {
        editingArtifactImages = [];
      }
    }
  } else {
    // Generate unique code for new artifact (e.g., HV-001, HV-002, etc.)
    let nextNum = ARTIFACTS_DATA.length + 1;
    let nextCode = `HV-${String(nextNum).padStart(3, '0')}`;
    while (ARTIFACTS_DATA.some(a => a && a.code === nextCode)) {
      nextNum++;
      nextCode = `HV-${String(nextNum).padStart(3, '0')}`;
    }
    document.getElementById('modalArtCode').value = nextCode;
    document.getElementById('modalArtTitle').value = '';
    document.getElementById('modalArtEthnic').value = '';
    document.getElementById('modalArtRegion').value = 'Vùng núi cao phía Bắc';
    document.getElementById('modalArtMaterial').value = '';
    document.getElementById('modalArtLocation').value = 'Kho Bảo Quản 1';
    document.getElementById('modalArtImgUrl').value = '';
    editingArtifactImages = [];
  }

  renderModalGallery();
  
  const deleteBtn = document.getElementById('modalDeleteArtifactBtn');
  if (deleteBtn) {
    deleteBtn.style.display = editingArtifactId !== null ? 'inline-flex' : 'none';
  }

  modal.classList.add('active');
}

function closeArtifactModal() {
  editingArtifactId = null;
  const deleteBtn = document.getElementById('modalDeleteArtifactBtn');
  if (deleteBtn) deleteBtn.style.display = 'none';
  document.getElementById('artifactModal').classList.remove('active');
}

async function handleSaveArtifact(event) {
  event.preventDefault();
  const codeInput = document.getElementById('modalArtCode').value.trim();
  const titleInput = document.getElementById('modalArtTitle').value.trim();
  const ethnicInput = document.getElementById('modalArtEthnic').value.trim();
  const regionInput = document.getElementById('modalArtRegion').value;
  const materialInput = document.getElementById('modalArtMaterial').value.trim();
  const locationInput = document.getElementById('modalArtLocation').value;
  
  const code = codeInput || `HV-${String(ARTIFACTS_DATA.length + 1).padStart(3, '0')}`;
  const title = titleInput || 'Hiện vật mới';
  const ethnic = ethnicInput || 'Chưa xác định';
  const region = regionInput || 'Vùng núi cao phía Bắc';
  const material = materialInput || 'Chưa xác định';
  const location = locationInput || 'Kho Bảo Quản 1';

  // Auto-check typed/pasted URL in modalArtImgUrl input field
  const typedUrl = document.getElementById('modalArtImgUrl')?.value.trim();
  if (typedUrl) {
    let cleanTyped = typedUrl;
    if (cleanTyped.startsWith('www.')) cleanTyped = 'https://' + cleanTyped;
    if (cleanTyped.startsWith('data:image/')) {
      cleanTyped = await compressImage(cleanTyped);
    }
    if (!editingArtifactImages.includes(cleanTyped)) {
      editingArtifactImages.push(cleanTyped);
    }
  }

  const primaryImg = editingArtifactImages.length > 0 ? editingArtifactImages[0] : 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80';
  const allImages = editingArtifactImages.length > 0 ? [...editingArtifactImages] : [primaryImg];

  let targetArt = null;
  if (editingArtifactId !== null && editingArtifactId !== undefined && editingArtifactId !== '' && editingArtifactId !== 'undefined') {
    targetArt = ARTIFACTS_DATA.find(item => 
      String(item.id) === String(editingArtifactId) || 
      item.code === String(editingArtifactId)
    );
  }

  if (targetArt) {
    targetArt.code = code;
    targetArt.title = title;
    targetArt.ethnic = ethnic;
    targetArt.region = region;
    targetArt.material = material;
    targetArt.location = location;
    targetArt.img = primaryImg;
    targetArt.images = allImages;
    targetArt.audioText = `Hiện vật ${title} của Dân tộc ${ethnic}.`;
    showToast(`Đã cập nhật thành công hồ sơ hiện vật ${code}!`, 'success');
  } else {
    const newArt = {
      id: Date.now(),
      code: code,
      title: title,
      ethnic: ethnic,
      region: region,
      material: material,
      era: 'Thế kỷ XX',
      location: location,
      status: 'Nguyên vẹn',
      img: primaryImg,
      images: allImages,
      meaning: 'Hồ sơ di sản mới được bổ sung vào hệ thống kiểm kê kho.',
      audioText: `Hiện vật ${title} của Dân tộc ${ethnic}.`
    };
    targetArt = newArt;
    ARTIFACTS_DATA.unshift(newArt);
    showToast(`Đã thêm mới hồ sơ hiện vật ${code} vào hệ thống kho!`, 'success');
  }

  // Filter out any corrupted entries
  ARTIFACTS_DATA = ARTIFACTS_DATA.map(normalizeArtifact).filter(Boolean);

  // Save to LocalStorage safely
  try {
    localStorage.setItem('baotang_artifacts_data', JSON.stringify(ARTIFACTS_DATA));
  } catch (storageErr) {
    console.warn('⚠️ LocalStorage Quota Exceeded:', storageErr);
  }

  // Sync to REST API backend if running
  try {
    fetch('/api/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetArt)
    }).catch(() => {});
  } catch (err) {}

  renderInventoryTable(ARTIFACTS_DATA);
  renderCatalog(ARTIFACTS_DATA);
  renderDashboardStats();

  // If user is currently viewing this artifact in detail view, update detail view too
  if (typeof currentArtifact !== 'undefined' && currentArtifact && String(currentArtifact.id) === String(targetArt.id)) {
    openArtifactDetail(targetArt.id);
  }

  closeArtifactModal();
}

/**
 * Delete an artifact by ID or code
 */
function deleteArtifact(id) {
  const targetId = id !== undefined && id !== null ? id : editingArtifactId;
  if (!targetId) return;

  const art = ARTIFACTS_DATA.find(item => String(item.id) === String(targetId) || item.code === String(targetId));
  const artName = art ? `${art.code} - ${art.title}` : `hiện vật`;

  if (!confirm(`Bạn có chắc chắn muốn xóa ${artName} khỏi kho lưu trữ di sản?`)) {
    return;
  }

  // Remove from memory array
  ARTIFACTS_DATA = ARTIFACTS_DATA.filter(item => String(item.id) !== String(targetId) && item.code !== String(targetId));

  // Sync to LocalStorage
  try {
    localStorage.setItem('baotang_artifacts_data', JSON.stringify(ARTIFACTS_DATA));
  } catch (storageErr) {
    console.warn('⚠️ LocalStorage Quota Exceeded:', storageErr);
  }

  // Sync DELETE to REST API backend
  try {
    fetch(`/api/artifacts/${targetId}`, {
      method: 'DELETE'
    }).catch(() => {});
  } catch (err) {}

  showToast(`Đã xóa thành công ${artName}!`, 'info');

  // Refresh UI tables and catalog
  renderInventoryTable(ARTIFACTS_DATA);
  renderCatalog(ARTIFACTS_DATA);
  renderDashboardStats();

  // Close modal if open
  closeArtifactModal();
}

/* Global Clipboard Paste Listener for Ctrl + V */
window.addEventListener('paste', function(e) {
  const modal = document.getElementById('artifactModal');
  if (!modal || !modal.classList.contains('active')) return;

  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  let addedCount = 0;

  // 1. Image items from clipboard (screenshots, copied files)
  const items = clipboardData.items;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = function(evt) {
            addArtifactImages(evt.target.result);
            const inputBox = document.getElementById('modalArtImgUrl');
            if (inputBox) inputBox.value = '';
            showToast('Đã dán (Ctrl+V) 1 ảnh từ bộ nhớ tạm!', 'success');
          };
          reader.readAsDataURL(file);
          addedCount++;
        }
      }
    }
  }

  // 2. Text URL strings pasted into modal
  if (addedCount === 0) {
    const pastedText = clipboardData.getData('text');
    if (pastedText) {
      let cleanText = pastedText.trim();
      if (cleanText.startsWith('www.')) cleanText = 'https://' + cleanText;

      const textLines = cleanText.split(/\s+/).map(s => s.trim()).filter(Boolean);
      let textAdded = 0;
      textLines.forEach(text => {
        let u = text;
        if (u.startsWith('www.')) u = 'https://' + u;
        if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image/') || u.startsWith('blob:')) {
          addArtifactImages(u);
          textAdded++;
        }
      });
      if (textAdded > 0) {
        showToast(`Đã dán (Ctrl+V) ${textAdded} đường dẫn ảnh!`, 'success');
      } else if (cleanText.length > 5) {
        // Fallback for general image text / links
        addArtifactImages(cleanText);
        showToast('Đã nhận diện đường dẫn ảnh dán vào form!', 'info');
      }
    }
  }
});

/**
 * UI-15: Storage Location Transfer Management
 */
function openBorrowModal() {
  const modal = document.getElementById('borrowModal');
  if (modal) modal.classList.add('active');
}

function closeBorrowModal() {
  const modal = document.getElementById('borrowModal');
  if (modal) modal.classList.remove('active');
}

function handleSaveBorrow(event) {
  event.preventDefault();
  const artName = document.getElementById('modalBorrowArtifact').value.trim();
  const borrower = document.getElementById('modalBorrower').value.trim();
  const returnDate = document.getElementById('modalBorrowReturnDate').value;
  const purpose = document.getElementById('modalBorrowPurpose').value.trim();

  const newBorrow = {
    id: BORROW_DATA.length + 1,
    code: `PM-2026-0${BORROW_DATA.length + 1}`,
    artifact: artName,
    borrower: borrower,
    purpose: purpose,
    returnDate: returnDate,
    status: 'DANG_MUON'
  };

  BORROW_DATA.unshift(newBorrow);
  localStorage.setItem('baotang_borrow_data', JSON.stringify(BORROW_DATA));

  try {
    fetch(`${API_BASE}/tickets/borrows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBorrow)
    }).catch(() => {});
  } catch (e) {}

  renderBorrowTable(BORROW_DATA);
  closeBorrowModal();
  showToast(`Đã lập thành công phiếu mượn di sản ${newBorrow.code}!`, 'success');
}

function openTourModal() {
  const modal = document.getElementById('tourModal');
  if (modal) {
    const elName = document.getElementById('modalTourName');
    const elWard = document.getElementById('modalTourWard');
    const elProv = document.getElementById('modalTourProvince');
    const elSize = document.getElementById('modalTourSize');
    const elGuide = document.getElementById('modalTourGuide');
    if (elName) elName.value = '';
    if (elWard) elWard.value = '';
    if (elProv) elProv.value = '';
    if (elSize) elSize.value = '';
    if (elGuide) elGuide.value = '';
    modal.classList.add('active');
  }
}

function closeTourModal() {
  const modal = document.getElementById('tourModal');
  if (modal) modal.classList.remove('active');
}

function handleSaveTour(event) {
  event.preventDefault();

  const tourName = document.getElementById('modalTourName').value.trim();
  const ward = document.getElementById('modalTourWard') ? document.getElementById('modalTourWard').value.trim() : '';
  const province = document.getElementById('modalTourProvince') ? document.getElementById('modalTourProvince').value.trim() : '';
  const tourTarget = document.getElementById('modalTourTarget') ? document.getElementById('modalTourTarget').value : 'Du khách';
  const tourSize = document.getElementById('modalTourSize').value;
  const guide = document.getElementById('modalTourGuide').value.trim();

  const fullNameWithLoc = (ward || province) ? `${tourName} (${[ward, province].filter(Boolean).join(', ')})` : tourName;

  const randomNum = Math.floor(100 + Math.random() * 900);
  const newTour = {
    id: Date.now(),
    code: `#DOAN-${randomNum}`,
    name: fullNameWithLoc,
    ward: ward,
    province: province,
    target: tourTarget,
    size: `${tourSize} Khách`,
    time: 'Hôm nay',
    guide: guide,
    status: 'Chờ Đón Tiếp'
  };

  TOURS_DATA.unshift(newTour);
  localStorage.setItem('baotang_tours_data', JSON.stringify(TOURS_DATA));

  // Sync to REST API backend for multi-device support
  try {
    fetch(`${API_BASE}/tickets/tours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTour)
    }).catch(() => {});
  } catch (err) {}

  renderTourTable(TOURS_DATA);
  closeTourModal();
  showToast(`Đã đăng ký thành công lịch đoàn ${newTour.code}!`, 'success');
}

function deleteTour(id) {
  const tour = TOURS_DATA.find(t => String(t.id) === String(id) || t.code === String(id));
  const tourName = tour ? `${tour.code} - ${tour.name}` : 'lịch đoàn';

  if (!confirm(`Bạn có chắc chắn muốn xóa ${tourName} khỏi danh sách đăng ký?`)) {
    return;
  }

  TOURS_DATA = TOURS_DATA.filter(t => String(t.id) !== String(id) && t.code !== String(id));
  localStorage.setItem('baotang_tours_data', JSON.stringify(TOURS_DATA));

  // Sync DELETE to REST API backend
  try {
    fetch(`${API_BASE}/tickets/tours/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  } catch (err) {}

  renderTourTable(TOURS_DATA);
  showToast(`Đã xóa thành công ${tourName}!`, 'info');
}

function renderTourTable(tours) {
  const tbody = document.getElementById('tourTableBody');
  if (!tbody) return;

  if (!tours || tours.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          <i class="fa-solid fa-calendar-days" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--primary-gold); display: block;"></i>
          <strong>Chưa có lịch đoàn tham quan nào được đăng ký.</strong>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Nhấn nút "Đăng Ký Lịch Đoàn Mới" phía trên để thêm mới.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tours.map(t => `
    <tr>
      <td><strong>${t.code}</strong></td>
      <td>${t.name}</td>
      <td><span class="badge-status badge-info">${t.target || 'Du khách'}</span></td>
      <td>${t.size}</td>
      <td>${t.time}</td>
      <td>${t.guide}</td>
      <td><span class="badge-status badge-warning">${t.status}</span></td>
      <td>
        <button type="button" class="btn-danger btn-sm" onclick="deleteTour('${t.id}')">
          <i class="fa-solid fa-trash-can"></i> Xóa
        </button>
      </td>
    </tr>
  `).join('');
}

function renderRestorationTable(logs) {
  const tbody = document.getElementById('restorationTableBody');
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          <i class="fa-solid fa-screwdriver-wrench" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--primary-gold); display: block;"></i>
          <strong>Chưa có nhật ký bảo quản / phục chế hiện vật nào.</strong>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td><strong>${l.code}</strong></td>
      <td>${l.artifact}</td>
      <td>${l.desc}</td>
      <td>${l.solution}</td>
      <td>${l.staff}</td>
      <td>${l.date}</td>
    </tr>
  `).join('');
}

/**
 * UI-16: Borrow & Return Management
 */
function renderBorrowTable(borrows) {
  const tbody = document.getElementById('borrowTableBody');
  if (!tbody) return;

  if (!borrows || borrows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          <i class="fa-solid fa-handshake" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--primary-gold); display: block;"></i>
          <strong>Chưa có phiếu mượn di sản triển lãm nào được lập.</strong>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Nhấn nút "Lập Phiếu Mượn Mới" phía trên để tạo mới.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = borrows.map(b => `
    <tr>
      <td><strong>${b.code}</strong></td>
      <td>${b.artifact}</td>
      <td><strong>${b.borrower}</strong></td>
      <td>${b.purpose}</td>
      <td>${b.returnDate}</td>
      <td>
        <span class="badge-status ${b.status === 'DA_TRA' ? 'badge-success' : 'badge-warning'}">
          ${b.status === 'DA_TRA' ? 'Đã Trả' : 'Đang Mượn'}
        </span>
      </td>
      <td>
        ${b.status === 'DANG_MUON' 
          ? `<button type="button" class="btn-secondary btn-sm" onclick="handleReturnArtifact(${b.id})"><i class="fa-solid fa-rotate-left"></i> Ghi Nhận Trả</button>` 
          : '<span style="color: var(--text-dim); font-size:0.8rem;">Hoàn tất</span>'}
      </td>
    </tr>
  `).join('');
}

function handleReturnArtifact(id) {
  const b = BORROW_DATA.find(item => item.id === id);
  if (b) {
    b.status = 'DA_TRA';
    renderBorrowTable(BORROW_DATA);
    showToast(`Đã ghi nhận trả hiện vật cho phiếu ${b.code}!`, 'success');
  }
}

/**
 * UI-18: POS Ticket Counter
 */
function addPosItem(name, price) {
  posCartTotal = price;
  const priceDisplay = price === 0 ? 'MIỄN PHÍ' : price.toLocaleString('vi-VN') + ' VNĐ';
  document.getElementById('posTotalText').textContent = priceDisplay;
  document.getElementById('posCartItems').innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
      <span>01x ${name}</span>
      <strong>${priceDisplay}</strong>
    </div>
  `;
}

function handlePosCheckout() {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const ticketCode = `#POS-VE-${randomNum}`;

  document.getElementById('ticketCodeText').textContent = `Mã Vé Quầy: ${ticketCode}`;
  document.getElementById('ticketOwnerName').textContent = 'Khách Mua Tại Quầy POS';
  document.getElementById('ticketUseDate').textContent = 'Hôm Nay';
  document.getElementById('ticketDetailText').textContent = '01 Vé Tham quan tại quầy (30.000 VNĐ)';
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=POS-${ticketCode}`;
  document.getElementById('ticketQrImage').src = qrUrl;

  const isFree = posCartTotal === 0;
  const ticketRecord = {
    id: Date.now(),
    code: ticketCode,
    name: 'Khách Quầy POS',
    phone: '',
    adultQty: isFree ? 0 : 1,
    childQty: isFree ? 1 : 0,
    totalQty: 1,
    amount: posCartTotal,
    type: 'POS',
    paymentMethod: 'Tiền mặt thu tại quầy',
    createdAt: new Date().toISOString()
  };
  TICKETS_PURCHASED_DATA.unshift(ticketRecord);
  try {
    localStorage.setItem('baotang_purchased_tickets_data', JSON.stringify(TICKETS_PURCHASED_DATA));
  } catch (e) {}

  renderDashboardStats();
  renderShiftReportStats();

  switchNav('viewMyTickets');
  showToast(`Đã in vé tại quầy POS thành công! Mã QR: ${ticketCode}`, 'success');
}

/**
 * UI-19: Gate QR Scanner
 */
function handleScanGateQr(event) {
  event.preventDefault();
  const inputVal = document.getElementById('scanQrInput').value.trim();
  const badge = document.getElementById('scanResultBadge');

  if (!inputVal) return;

  badge.style.display = 'block';
  badge.className = 'eticket-status-badge';
  badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> VÉ HỢP LỆ (${inputVal}) - MỜI VÀO CỬA`;
  
  showToast('Xác thực mã QR thành công! Ghi nhận 01 lượt vào cửa.', 'success');
}

/**
 * Booking Logics
 */
function changeTicketQty(qtyId, delta) {
  const el = document.getElementById(qtyId);
  if (!el) return;
  let val = parseInt(el.textContent) || 0;
  val = Math.max(0, val + delta);
  el.textContent = val;

  const adult = parseInt((document.getElementById('qtyAdult') || {}).textContent) || 0;
  const child = parseInt((document.getElementById('qtyChild') || {}).textContent) || 0;

  const total = adult * 30000;
  document.getElementById('bookingTotalPrice').textContent = total.toLocaleString('vi-VN') + ' VNĐ';
}

function handleProcessBooking(event) {
  event.preventDefault();
  const name = document.getElementById('bookingName').value.trim();
  const phone = document.getElementById('bookingPhone').value.trim();

  const adult = parseInt((document.getElementById('qtyAdult') || {}).textContent) || 0;
  const child = parseInt((document.getElementById('qtyChild') || {}).textContent) || 0;

  const totalQty = adult + child;
  if (totalQty === 0) {
    showToast('Vui lòng chọn ít nhất 1 vé tham quan!', 'error');
    return;
  }

  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const ticketCode = `#VE-2026-${randomNum}`;

  document.getElementById('ticketCodeText').textContent = `Mã Vé: ${ticketCode}`;
  document.getElementById('ticketOwnerName').textContent = name;
  document.getElementById('ticketUseDate').textContent = 'Hôm nay';
  
  let detailDesc = `${totalQty} vé (${adult} Vé Tham quan - 30k`;
  if (child > 0) detailDesc += `, ${child} Trẻ dưới 5t - Miễn phí`;
  detailDesc += ')';

  document.getElementById('ticketDetailText').textContent = detailDesc;
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=BAOTANG-${ticketCode}-${phone}`;
  document.getElementById('ticketQrImage').src = qrUrl;

  // Record purchased ticket data
  const ticketRecord = {
    id: Date.now(),
    code: ticketCode,
    name: name,
    phone: phone,
    adultQty: adult,
    childQty: child,
    totalQty: totalQty,
    amount: adult * 30000,
    type: 'ONLINE',
    paymentMethod: 'Chuyển khoản QR code',
    createdAt: new Date().toISOString()
  };
  TICKETS_PURCHASED_DATA.unshift(ticketRecord);
  try {
    localStorage.setItem('baotang_purchased_tickets_data', JSON.stringify(TICKETS_PURCHASED_DATA));
  } catch (e) {}

  renderDashboardStats();
  renderShiftReportStats();

  switchNav('viewMyTickets');
  showToast('Đặt vé thành công! Mã QR vé điện tử đã được khởi tạo.', 'success');
}

/**
 * UI-10: User Management
 */
function renderUserTable(users) {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>#${u.id}</td>
      <td><strong>${u.fullName}</strong></td>
      <td><code>${u.username}</code></td>
      <td>${u.email}<br><small style="color: var(--text-dim);">${u.phone}</small></td>
      <td><span class="profile-role-tag role-${u.role.toLowerCase()}">${u.roleName}</span></td>
      <td>
        ${u.isLocked 
          ? '<span style="color: #dc2626; font-weight:700;"><i class="fa-solid fa-lock"></i> Đã Khóa</span>' 
          : '<span style="color: #059669; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Hoạt Động</span>'}
      </td>
      <td>
        <button type="button" class="btn-secondary btn-sm" onclick="toggleLockUser(${u.id})">
          ${u.isLocked ? 'Mở' : 'Khóa'}
        </button>
      </td>
    </tr>
  `).join('');
}

function filterUserTable() {
  const query = document.getElementById('userSearchInput').value.toLowerCase().trim();
  const filtered = USERS_DATA.filter(u => 
    u.fullName.toLowerCase().includes(query) || u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
  );
  renderUserTable(filtered);
}

function openAddUserModal() {
  document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('active');
}

function handleSaveUser(event) {
  event.preventDefault();
  const fullName = document.getElementById('modalUserFullName').value.trim();
  const username = document.getElementById('modalUsername').value.trim();
  const role = document.getElementById('modalUserRole').value;
  const email = document.getElementById('modalUserEmail').value.trim();
  const phone = document.getElementById('modalUserPhone').value.trim();

  const roleNameMap = { ADMIN: 'Quản trị viên', THUKHO: 'Kiểm kê & Thủ kho', BANVE: 'Bán vé & Đón tiếp' };

  const newUser = {
    id: USERS_DATA.length + 1,
    fullName: fullName,
    username: username,
    email: email,
    phone: phone,
    role: role,
    roleName: roleNameMap[role],
    isLocked: false
  };

  USERS_DATA.push(newUser);
  renderUserTable(USERS_DATA);
  closeUserModal();
  showToast(`Đã tạo tài khoản cán bộ ${fullName} thành công!`, 'success');
}

function toggleLockUser(id) {
  const u = USERS_DATA.find(item => item.id === id);
  if (u) {
    u.isLocked = !u.isLocked;
    renderUserTable(USERS_DATA);
    showToast(u.isLocked ? `Đã khóa tài khoản ${u.fullName}` : `Đã mở khóa tài khoản ${u.fullName}`, 'info');
  }
}

// Category Management Initial Datasets (UI-11)
let TICKET_PRICES_DATA = JSON.parse(localStorage.getItem('TICKET_PRICES_DATA')) || [
  { id: 1, code: 'LV-01', name: 'Vé Tham Quan Bảo Tàng', price: 30000, note: 'Vé vào cổng phổ thông' },
  { id: 2, code: 'LV-02', name: 'Vé Trẻ Em (Dưới 5 Tuổi)', price: 0, note: 'Trẻ em dưới 5 tuổi được miễn phí 100% vé vào cổng' }
];

let ETHNICITIES_DATA = JSON.parse(localStorage.getItem('ETHNICITIES_DATA')) || [
  { id: 1, name: 'Dân tộc Tày', languageGroup: 'Tày - Thái', region: 'Vùng Việt Bắc' },
  { id: 2, name: 'Dân tộc Gia Rai', languageGroup: 'Môn - Khmer', region: 'Vùng Tây Nguyên' }
];

function saveCategoryDataToStorage() {
  localStorage.setItem('TICKET_PRICES_DATA', JSON.stringify(TICKET_PRICES_DATA));
  localStorage.setItem('ETHNICITIES_DATA', JSON.stringify(ETHNICITIES_DATA));
}

function renderCategoryTicketPricesTable() {
  const tbody = document.getElementById('catTicketPriceTableBody');
  if (!tbody) return;
  tbody.innerHTML = TICKET_PRICES_DATA.map(t => `
    <tr>
      <td><strong>${t.code}</strong></td>
      <td>${t.name}</td>
      <td><strong style="color: ${t.price > 0 ? 'var(--primary-gold)' : '#059669'};">${t.price > 0 ? t.price.toLocaleString('vi-VN') + ' VNĐ' : 'MIỄN PHÍ (0 VNĐ)'}</strong></td>
      <td>${t.note || '-'}</td>
      <td style="text-align: center;">
        <button type="button" class="btn-danger btn-sm" onclick="deleteTicketPrice('${t.id}')">
          <i class="fa-solid fa-trash"></i> Xóa
        </button>
      </td>
    </tr>
  `).join('');
}

function renderCategoryEthnicitiesTable() {
  const tbody = document.getElementById('catEthnicityTableBody');
  if (!tbody) return;
  tbody.innerHTML = ETHNICITIES_DATA.map(e => `
    <tr>
      <td>${e.id}</td>
      <td><strong>${e.name}</strong></td>
      <td>${e.languageGroup || '-'}</td>
      <td>${e.region || '-'}</td>
      <td style="text-align: center;">
        <button type="button" class="btn-danger btn-sm" onclick="deleteEthnicity('${e.id}')">
          <i class="fa-solid fa-trash"></i> Xóa
        </button>
      </td>
    </tr>
  `).join('');
}

function openAddTicketPriceModal() {
  document.getElementById('modalTicketCode').value = `LV-0${TICKET_PRICES_DATA.length + 1}`;
  document.getElementById('modalTicketName').value = '';
  document.getElementById('modalTicketPrice').value = '';
  document.getElementById('modalTicketNote').value = '';
  document.getElementById('addTicketPriceModal').classList.add('active');
}

function closeAddTicketPriceModal() {
  document.getElementById('addTicketPriceModal').classList.remove('active');
}

function handleAddTicketPrice(event) {
  event.preventDefault();
  const code = document.getElementById('modalTicketCode').value.trim();
  const name = document.getElementById('modalTicketName').value.trim();
  const price = parseInt(document.getElementById('modalTicketPrice').value, 10) || 0;
  const note = document.getElementById('modalTicketNote').value.trim();

  if (!code || !name) {
    showToast('Vui lòng điền đầy đủ Mã và Tên loại vé', 'warning');
    return;
  }

  const newTicket = {
    id: Date.now(),
    code: code,
    name: name,
    price: price,
    note: note || 'Vé áp dụng theo quy định bảo tàng'
  };

  TICKET_PRICES_DATA.push(newTicket);
  saveCategoryDataToStorage();
  renderCategoryTicketPricesTable();
  closeAddTicketPriceModal();
  showToast(`Đã thêm loại vé "${name}" thành công!`, 'success');
}

function deleteTicketPrice(id) {
  if (confirm('Bạn có chắc chắn muốn xóa loại vé này khỏi danh mục không?')) {
    TICKET_PRICES_DATA = TICKET_PRICES_DATA.filter(t => String(t.id) !== String(id));
    saveCategoryDataToStorage();
    renderCategoryTicketPricesTable();
    showToast('Đã xóa loại vé khỏi danh mục', 'info');
  }
}

function openAddEthnicityModal() {
  document.getElementById('modalEthName').value = '';
  document.getElementById('modalEthLanguage').value = '';
  document.getElementById('modalEthRegion').value = '';
  document.getElementById('addEthnicityModal').classList.add('active');
}

function closeAddEthnicityModal() {
  document.getElementById('addEthnicityModal').classList.remove('active');
}

function handleAddEthnicity(event) {
  event.preventDefault();
  const name = document.getElementById('modalEthName').value.trim();
  const languageGroup = document.getElementById('modalEthLanguage').value.trim();
  const region = document.getElementById('modalEthRegion').value.trim();

  if (!name) {
    showToast('Vui lòng nhập Tên dân tộc', 'warning');
    return;
  }

  const nextId = ETHNICITIES_DATA.length > 0 ? Math.max(...ETHNICITIES_DATA.map(e => parseInt(e.id, 10) || 0)) + 1 : 1;
  const newEth = {
    id: nextId,
    name: name,
    languageGroup: languageGroup || 'Chưa phân loại',
    region: region || 'Vùng văn hóa chung'
  };

  ETHNICITIES_DATA.push(newEth);
  saveCategoryDataToStorage();
  renderCategoryEthnicitiesTable();
  closeAddEthnicityModal();
  showToast(`Đã thêm "${name}" vào danh mục dân tộc!`, 'success');
}

function deleteEthnicity(id) {
  if (confirm('Bạn có chắc chắn muốn xóa dân tộc này khỏi danh mục hệ thống không?')) {
    ETHNICITIES_DATA = ETHNICITIES_DATA.filter(e => String(e.id) !== String(id));
    saveCategoryDataToStorage();
    renderCategoryEthnicitiesTable();
    showToast('Đã xóa dân tộc khỏi danh mục', 'info');
  }
}

function switchCategoryTab(tabId, btnElement) {
  const tabs = document.querySelectorAll('#viewCategoryManagement .tab-pane');
  tabs.forEach(tab => tab.classList.remove('active'));

  const btns = document.querySelectorAll('.admin-tabs .tab-btn');
  btns.forEach(b => b.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');
  if (btnElement) btnElement.classList.add('active');

  renderCategoryTicketPricesTable();
  renderCategoryEthnicitiesTable();
}

function setNlQueryPrompt(promptText) {
  document.getElementById('adminNlQueryInput').value = promptText;
}

async function handleExecuteAdminNlQuery(event) {
  event.preventDefault();
  const query = document.getElementById('adminNlQueryInput').value.trim();
  if (!query) return;

  const resultBox = document.getElementById('adminNlQueryResult');
  resultBox.innerHTML = `
    <div style="background: #fdfaef; border: 1.5px solid var(--primary-gold); padding: 1.25rem; border-radius: var(--radius-md);">
      <h4 style="color: #78350f; font-size: 1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích dữ liệu kho & doanh thu qua Google Gemini AI...</h4>
    </div>
  `;

  try {
    const res = await fetch('/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: query })
    });
    const data = await res.json();

    if (data.success && data.data) {
      resultBox.innerHTML = `
        <div style="background: #fdfaef; border: 1.5px solid var(--primary-gold); padding: 1.25rem; border-radius: var(--radius-md);">
          <h4 style="color: #78350f; font-size: 1.05rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-robot"></i> ${data.data.summary}</h4>
          <div style="font-size: 0.9rem; color: #451a03; line-height: 1.6;">${formatAiText(data.data.details)}</div>
        </div>
      `;
      showToast('Đã phân tích dữ liệu quản trị bằng Gemini AI thành công!', 'success');
    } else {
      resultBox.innerHTML = `<div style="color: red; padding: 1rem;">${data.message || 'Lỗi xử lý AI Admin'}</div>`;
    }
  } catch (err) {
    console.error('Lỗi Admin AI Query:', err);
    resultBox.innerHTML = `<div style="color: red; padding: 1rem;">Không thể kết nối đến server AI Admin.</div>`;
  }
}

function setRoleDemo(roleKey) {
  const buttons = document.querySelectorAll('.role-chips .role-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  
  const selectedBtn = Array.from(buttons).find(b => b.getAttribute('onclick').includes(roleKey));
  if (selectedBtn) selectedBtn.classList.add('active');

  const acc = DEMO_ACCOUNTS[roleKey];
  if (acc) {
    document.getElementById('loginUsername').value = acc.username;
    document.getElementById('loginPassword').value = acc.password;
  }
}

function handleLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('loginUsername').value.trim();
  const passwordInput = document.getElementById('loginPassword').value;

  let foundAcc = Object.values(DEMO_ACCOUNTS).find(
    acc => (acc.username.toLowerCase() === usernameInput.toLowerCase() || acc.email.toLowerCase() === usernameInput.toLowerCase())
  );

  if (foundAcc && foundAcc.password === passwordInput) {
    currentUser = { ...foundAcc };
    localStorage.setItem('baotang_staff_user', JSON.stringify(currentUser));

    renderProfileView(currentUser);
    updateNavigationVisibility(currentUser);
    document.getElementById('headerProfileBtn').style.display = 'inline-flex';
    document.getElementById('navLoginBtn').style.display = 'none';

    switchNav('viewProfile');
    showToast(`Đăng nhập thành công! Vai trò: ${currentUser.roleName}`, 'success');
  } else {
    showToast('Tên đăng nhập hoặc mật khẩu cán bộ không chính xác!', 'error');
  }
}

function renderProfileView(user) {
  if (!user) return;
  document.getElementById('profileFullName').textContent = user.fullName;
  
  const roleTag = document.getElementById('profileRoleTag');
  roleTag.textContent = user.roleName || 'Cán bộ';
  roleTag.className = `profile-role-tag ${user.roleBadgeClass || 'role-banve'}`;

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=f59e0b&color=0f172a&bold=true&size=128`;
  document.getElementById('userAvatarImg').src = avatarUrl;

  document.getElementById('profileInputFullName').value = user.fullName;
  document.getElementById('profileInputUsername').value = user.username;
  document.getElementById('profileInputEmail').value = user.email;
  document.getElementById('profileInputPhone').value = user.phone;
  document.getElementById('profileInputRoleDesc').value = user.roleDesc || user.roleName;
}

function switchProfileTab(tabId, btnElement) {
  const tabs = document.querySelectorAll('.tab-pane');
  tabs.forEach(tab => tab.classList.remove('active'));

  const menuBtns = document.querySelectorAll('.profile-menu .menu-btn');
  menuBtns.forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');

  if (btnElement) btnElement.classList.add('active');
}

function handleUpdateProfile(event) {
  event.preventDefault();
  if (!currentUser) return;

  currentUser.fullName = document.getElementById('profileInputFullName').value.trim();
  currentUser.email = document.getElementById('profileInputEmail').value.trim();
  currentUser.phone = document.getElementById('profileInputPhone').value.trim();

  localStorage.setItem('baotang_staff_user', JSON.stringify(currentUser));
  renderProfileView(currentUser);

  showToast('Đã cập nhật thông tin cán bộ thành công!', 'success');
}

function handleChangePassword(event) {
  event.preventDefault();
  if (!currentUser) return;

  const pwdCurrent = document.getElementById('pwdCurrent').value;
  const pwdNew = document.getElementById('pwdNew').value;
  const pwdConfirm = document.getElementById('pwdConfirm').value;

  if (pwdCurrent !== currentUser.password) {
    showToast('Mật khẩu hiện tại không đúng!', 'error');
    return;
  }

  if (pwdNew !== pwdConfirm) {
    showToast('Mật khẩu mới và xác nhận mật khẩu không trùng khớp!', 'error');
    return;
  }

  currentUser.password = pwdNew;
  localStorage.setItem('baotang_staff_user', JSON.stringify(currentUser));

  document.getElementById('changePasswordForm').reset();
  showToast('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.', 'success');
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('baotang_staff_user');
  
  updateNavigationVisibility(null);
  document.getElementById('headerProfileBtn').style.display = 'none';
  document.getElementById('navLoginBtn').style.display = 'inline-flex';

  switchNav('viewHome');
  showToast('Đã đăng xuất. Chuyển sang giao diện Công chúng / Khách hàng.', 'info');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconClass = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
  
  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 50);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}
