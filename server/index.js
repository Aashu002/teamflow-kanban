const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3001;

// Setup HTTP server and Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', credentials: true }
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

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

server.listen(PORT, () => {
  console.log(`🚀 TeamFlow API & WebSockets running on http://localhost:${PORT}`);
});
