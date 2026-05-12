import mongoose from 'mongoose';

// MongoDB connection configuration
// Fallback to default MongoDB Atlas connection if .env is not configured
const MONGODB_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb+srv://skxngna_db_user:Cookie30302547@bearthai-cluster.g4cyx64.mongodb.net/?appName=bearthai-cluster';

if (!MONGODB_URI) {
  console.error('❌ Error: DATABASE_URL or MONGODB_URI is required!');
  console.error('📝 Please set DATABASE_URL in your .env file');
  console.error('   Format: mongodb+srv://username:password@cluster.mongodb.net/dbname');
  throw new Error('DATABASE_URL environment variable is not set');
}

// Connection options for Mongoose 8+
// Note: bufferCommands is deprecated in Mongoose 8+, buffering is automatically disabled
const connectionOptions = {
  serverSelectionTimeoutMS: 30000, // How long to try selecting a server (30 seconds)
  socketTimeoutMS: 60000, // How long to wait for a response (60 seconds)
  connectTimeoutMS: 30000, // How long to wait for initial connection (30 seconds)
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 2, // Minimum number of connections in the pool
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds to keep connection alive
};

// Create and cache connection
const globalForMongoose = globalThis;

let cached = globalForMongoose.mongoose;

if (!cached) {
  cached = globalForMongoose.mongoose = { conn: null, promise: null };
}

// Connect to MongoDB (รองรับ Vercel serverless: เช็ค readyState จริงก่อน return)
async function connectDB() {
  try {
    const state = mongoose.connection.readyState;
    // 1 = connected. ใช้ได้เฉพาะเมื่อแน่ใจว่าเชื่อมต่ออยู่
    if (cached.conn && state === 1) {
      return cached.conn;
    }

    // 0 = disconnected, 2 = connecting, 3 = disconnecting → เคลียร์ cache ถ้าเคยมี
    if (state !== 1 && cached.conn) {
      try {
        await mongoose.connection.close();
      } catch (e) {
        // Ignore
      }
      cached.conn = null;
      cached.promise = null;
    }

    // ถ้ากำลัง connect อยู่ รอให้จบ
    if (cached.promise) {
      const conn = await cached.promise;
      if (mongoose.connection.readyState === 1) return conn;
      cached.promise = null;
      cached.conn = null;
    }

    // เชื่อมต่อใหม่
    cached.promise = mongoose.connect(MONGODB_URI, connectionOptions)
      .then((mongooseInstance) => {
        cached.conn = mongooseInstance;
        console.log('✅ Connected to MongoDB');
        return cached.conn;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        cached.promise = null;
        cached.conn = null;
        throw error;
      });

    const conn = await cached.promise;
    if (mongoose.connection.readyState !== 1) {
      cached.promise = null;
      cached.conn = null;
      throw new Error('Client must be connected before running operations');
    }
    return conn;
  } catch (error) {
    console.error('❌ connectDB error:', error);
    console.error('   URI prefix:', MONGODB_URI ? MONGODB_URI.substring(0, 20) + '...' : 'undefined');
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
}

// Initialize connection
// Initialize connection - REMOVED immediate call
// connectDB();

mongoose.connection.on('connected', () => {
  console.log('📚 MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

export default connectDB;
export { connectDB, mongoose };
