const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

// Setup HTTP server and Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: isProd ? true : 'http://localhost:5173', 
    credentials: true 
  }
});

// Attach io to the Express app so routers can broadcast
app.set('io', io);

// Basic socket connection handling
io.on('connection', (socket) => {
  socket.on('join_project', (projectId) => {
    socket.join(`project_${projectId}`);
  });
  
  socket.on('leave_project', (projectId) => {
    socket.leave(`project_${projectId}`);
  });
});

app.use(cors({ 
  origin: isProd ? true : 'http://localhost:5173', 
  credentials: true 
}));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/search', require('./routes/search'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ─── PRODUCTION ──────────────────────────────────────────────────────────────
if (isProd) {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  
  // SPA fallback: All routes not starting with /api or /uploads serve index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`🚀 TeamFlow ${isProd ? 'Production' : 'Dev'} Server running on http://localhost:${PORT}`);
});
