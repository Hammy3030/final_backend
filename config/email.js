import nodemailer from 'nodemailer';

export const EMAIL_CONFIG = {
  enabled: process.env.EMAIL_ENABLED === 'true' || process.env.EMAIL_ENABLED === '1' || false,
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number.parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'patcharapongham@gmail.com',
    pass: process.env.SMTP_PASS || 'snqxgbaaqozctbxq'
  },
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'patcharapongham@gmail.com',
  appName: process.env.APP_NAME || 'BearThai',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
};

// Create reusable transporter object using the default SMTP transport
export const createTransporter = () => {
  if (!EMAIL_CONFIG.enabled || !EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn('⚠️ Email not configured. Set EMAIL_ENABLED=true and SMTP credentials in .env');
    return null;
  }

  return nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure, // true for 465, false for other ports
    auth: EMAIL_CONFIG.auth,
    tls: {
      rejectUnauthorized: false // For Gmail, sometimes needed
    }
  });
};

// --- เพิ่มฟังก์ชันที่หายไปด้านล่างนี้ ---
export const buildVerifyEmailUrl = (token) => {
  return `${EMAIL_CONFIG.frontendUrl}/verify-email?token=${token}`;
};

export default EMAIL_CONFIG;