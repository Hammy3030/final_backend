import { AuthService } from '../services/authService.js';
import { DatabaseService } from '../services/databaseService.js';
import { EMAIL_CONFIG } from '../config/email.js';

export class AuthController {
  static async register(req, res) {
    try {
      const { email, password, role, name, school, studentCode } = req.body;

      // Check if email already exists
      const existingUser = await AuthService.findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'อีเมลนี้มีผู้ใช้แล้ว'
        });
      }

      // Create user (with email verification token)
      const user = await AuthService.createUser({
        email,
        password,
        role,
        name,
        school,
        studentCode
      });

      // Don't generate token or QR code yet - user needs to verify email first

      // Determine message based on email configuration
      const successMessage = EMAIL_CONFIG.enabled 
        ? 'สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี'
        : 'สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลหรือ console สำหรับลิงก์ยืนยัน';

      res.status(201).json({
        success: true,
        message: successMessage,
        data: {
          email: user.email,
          requiresEmailVerification: true
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        details: error.details
      });
      
      // Provide more specific error messages
      let errorMessage = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
      
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        errorMessage = 'อีเมลนี้มีผู้ใช้แล้ว';
      } else if (error.message?.includes('password')) {
        errorMessage = 'รหัสผ่านไม่ถูกต้อง';
      } else if (error.message?.includes('email')) {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({
        success: false,
        message: errorMessage
      });
    }
  }

  static async login(req, res) {
    try {
      let { email, password } = req.body;
      if (email) email = email.trim();

      // Support login with studentCode for students (no password required)
      let loginEmail = email;
      let loginPassword = password;
      let isStudentCodeLogin = false;

      // Check if input is a studentCode (e.g., stu01-001 or STU001)
      if (email && !email.includes('@') && /^(stu|STU)[^@\s]+$/i.test(email)) {
        isStudentCodeLogin = true;
        // Find student by studentCode
        const { Student } = await import('../models/Student.js');
        const student = await Student.findOne({ 
          studentCode: { $regex: new RegExp(`^${email}$`, 'i') } 
        }).populate('userId');
        
        if (!student || !student.userId) {
          return res.status(401).json({
            success: false,
            message: 'รหัสนักเรียนไม่ถูกต้อง'
          });
        }

        // Get user email from student's userId
        loginEmail = student.userId.email;
        // For student login, use default password if no password provided
        loginPassword = password || 'default123';
      }

      // Login with JWT + bcrypt
      const loginResult = await AuthService.loginWithEmailPassword(loginEmail, loginPassword);

      if (!loginResult.user) {
        return res.status(401).json({
          success: false,
          message: isStudentCodeLogin 
            ? 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง'
            : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        });
      }

      // Check if email is verified
      const skipVerify = process.env.BYPASS_EMAIL_VERIFY === 'true' || process.env.BYPASS_EMAIL_VERIFY === '1';
      if (!loginResult.user.isEmailVerified && !skipVerify) {
        return res.status(403).json({
          success: false,
          message: 'กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ'
        });
      }

      // Generate JWT token
      const token = AuthService.generateToken(loginResult.user.id, loginResult.user.role);

      // Extract classroom ID for student
      const classroomId = loginResult.user.student?.classroomId?._id || loginResult.user.student?.classroomId?._id?.toString() || loginResult.user.student?.classroomId?.toString();

      res.json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        data: {
          user: {
            id: loginResult.user.id,
            email: loginResult.user.email,
            role: loginResult.user.role,
            name: loginResult.user.role === 'TEACHER' ? loginResult.user.teacher?.name : loginResult.user.student?.name,
            ...(loginResult.user.role === 'TEACHER' && { school: loginResult.user.teacher?.school }),
            ...(loginResult.user.role === 'STUDENT' && {
              studentCode: loginResult.user.student?.studentCode,
              classroom: classroomId
            })
          },
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ'
      });
    }
  }

  static async getProfile(req, res) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'ไม่พบ Token'
        });
      }

      // Validate session and get user profile
      const user = await AuthService.validateUserSession(token);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Session ไม่ถูกต้อง'
        });
      }

      // Extract classroom ID for student
      const classroomId = user.student?.classroomId?._id || user.student?.classroomId?._id?.toString() || user.student?.classroomId?.toString();

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.role === 'TEACHER' ? user.teacher?.name : user.student?.name,
            ...(user.role === 'TEACHER' && { school: user.teacher?.school }),
            ...(user.role === 'STUDENT' && {
              studentCode: user.student?.studentCode,
              classroom: classroomId
            })
          }
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token ไม่ถูกต้องหรือหมดอายุ'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้'
      });
    }
  }

  static async verifyEmail(req, res) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบ token สำหรับยืนยันอีเมล'
        });
      }

      // Verify email token
      const result = await AuthService.verifyEmailToken(token);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      // Generate JWT token for auto-login
      const jwtToken = AuthService.generateToken(result.user.id, result.user.role);

      res.json({
        success: true,
        message: 'ยืนยันอีเมลสำเร็จ',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role
          },
          token: jwtToken
        }
      });
    } catch (error) {
      console.error('Verify email error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการยืนยันอีเมล'
      });
    }
  }
}
