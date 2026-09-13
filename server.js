const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Static Frontend Assets (HTML, CSS, JS, Images)
app.use(express.static(path.join(__dirname, './')));

// Import REST API Routes
const authRoutes = require('./routes/auth.routes');
const artifactRoutes = require('./routes/artifact.routes');
const ticketRoutes = require('./routes/ticket.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const aiRoutes = require('./routes/ai.routes');

// Register API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/artifacts', artifactRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ai', aiRoutes);

// Healthcheck Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend Node.js API Server - Bảo tàng Văn hóa các Dân tộc Việt Nam',
    timestamp: new Date().toISOString()
  });
});

// Robots.txt & Sitemap SEO Endpoints
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Serve Single Page Application (SPA) index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`============================================================`);
  console.log(`🏛️ BẢO TÀNG VĂN HÓA CÁC DÂN TỘC VIỆT NAM - BACKEND SERVER`);
  console.log(`🚀 Node.js Express RESTful API Server running on port ${PORT}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`============================================================`);
});
