/**
 * โหลด .env ก่อน module อื่นที่อ่าน process.env (แก้ลำดับ import ใน ESM)
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');

if (process.env.NODE_ENV !== 'production') {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }
} else {
  dotenv.config();
}
