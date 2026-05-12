import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '.env');

if (process.env.NODE_ENV !== 'production') {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }
} else {
  dotenv.config();
}

// Import middleware, routes, and database config
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.js';
import teacherRoutes from './routes/teacher.js';
import studentRoutes from './routes/student.js';
import lessonRoutes from './routes/lesson.js';
import adminRoutes from './routes/admin.js';
import ttsRoutes from './routes/ttsRoutes.js';

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 100
});

// --- แก้ไขส่วน CORS ให้รองรับ Vercel Preview URL ---
const getCorsOrigins = () => {
  // ในช่วงพัฒนา/ทดสอบบน Vercel วิธีที่ชัวร์ที่สุดคือ return true 
  // เพื่อให้อนุญาตทุก Origin ที่เรียกเข้ามา (แก้ปัญหา URL เปลี่ยนบ่อย)
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
    return true;
  }

  // สำหรับ Production จริงๆ สามารถระบุ URL หลักได้ใน FRONTEND_URL
  return process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : true;
};

// Middleware
app.use(cors({
  origin: getCorsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
}));

app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check & Root
app.get('/', (req, res) => res.send('BearThai Backend is working!'));
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Static files
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.use('/uploads', express.static('public/uploads'));
}

// Database connection handling
const isProductionVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;

if (!isProductionVercel) {
  // Local/Normal Server: Connect to DB once at startup
  connectDB().catch(err => {
    console.error('Initial Database connection failed:', err);
  });
} else {
  // Vercel Serverless: Connect via middleware to handle cold starts
  app.use(async (req, res, next) => {
    try {
      await connectDB();
      next();
    } catch (error) {
      console.error('Database connection failed:', error);
      res.status(503).json({ success: false, message: 'Database connection failed.' });
    }
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teacher', authMiddleware, teacherRoutes);
app.use('/api/student', authMiddleware, studentRoutes);
app.use('/api/lessons', authMiddleware, lessonRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/tts', ttsRoutes);

// Error handling
app.use(errorHandler);

// Socket.io (Only for non-Vercel environments)
let server, io;

if (!isProductionVercel) {
  server = createServer(app);
  io = new Server(server, {
    cors: {
      origin: "*", // หรือระบุ URL หน้าบ้าน
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-classroom', (id) => socket.join(`classroom-${id}`));
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`🚀 Local Server on port ${PORT}`));
}

export default app;
export { io };
