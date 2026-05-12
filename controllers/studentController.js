import { StudentService } from '../services/studentService.js';
import { WritingAttempt } from '../models/WritingAttempt.js';
import { APP_CONFIG } from '../config/app.js';
import { extractStudentIds, normalizeStudentId } from '../helpers/studentIdHelper.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StudentController {
  // Debug endpoint to check student authentication status
  static async checkAuthStatus(req, res) {
    try {
      const student = req.user.student;

      let classroomIdValue = null;
      if (student?.classroomId) {
        if (typeof student.classroomId === 'object' && student.classroomId._id) {
          classroomIdValue = student.classroomId._id.toString();
        } else {
          classroomIdValue = student.classroomId.toString();
        }
      }

      let message = 'Student record not found';
      if (student) {
        message = student.classroomId
          ? 'Student has classroom'
          : 'Student exists but no classroom assigned';
      }

      return res.json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            role: req.user.role,
            email: req.user.email
          },
          student: student ? {
            id: student._id || student.id,
            classroomId: student.classroomId,
            classroomIdType: typeof student.classroomId,
            hasClassroomId: !!student.classroomId,
            classroomIdValue
          } : null,
          message
        }
      });
    } catch (error) {
      console.error('Check auth status error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ'
      });
    }
  }

  static async getLessons(req, res) {
    try {
      const { studentId, classroomId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      if (!classroomId) {
        return res.status(400).json({
          success: false,
          message: 'นักเรียนยังไม่ได้อยู่ในห้องเรียนใด'
        });
      }

      const lessons = await StudentService.getStudentLessons(studentId, classroomId);

      res.json({
        success: true,
        data: { lessons }
      });
    } catch (error) {
      console.error('Get lessons error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลบทเรียน'
      });
    }
  }

  static async getPreTestStatus(req, res) {
    try {
      const { lessonId } = req.params;
      const { studentId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const status = await StudentService.getPreTestStatus(studentId, lessonId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Get pre-test status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการตรวจสอบสถานะแบบทดสอบก่อนเรียน'
      });
    }
  }

  static async getPostTestStatus(req, res) {
    try {
      const { lessonId } = req.params;
      const { studentId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const status = await StudentService.getPostTestStatus(studentId, lessonId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Get post-test status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการตรวจสอบสถานะแบบทดสอบหลังเรียน'
      });
    }
  }

  static async completeLesson(req, res) {
    try {
      const { lessonId } = req.params;
      const { studentId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const lessonProgress = await StudentService.completeLesson(studentId, lessonId);

      res.json({
        success: true,
        message: 'เรียนจบบทเรียนแล้ว',
        data: { lessonProgress }
      });
    } catch (error) {
      console.error('Complete lesson error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการบันทึกความคืบหน้า'
      });
    }
  }

  static async submitActivity(req, res) {
    try {
      const { lessonId, activityId } = req.params;
      const { studentId } = extractStudentIds(req.user);
      const { answer, isCorrect, score, timeSpent } = req.body;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const activityResult = await StudentService.submitActivity(studentId, lessonId, activityId, {
        answer,
        isCorrect,
        score,
        timeSpent
      });

      res.json({
        success: true,
        message: 'บันทึกผลกิจกรรมสำเร็จ',
        data: { activityResult }
      });
    } catch (error) {
      console.error('Submit activity error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการบันทึกผลกิจกรรม'
      });
    }
  }

  static async getTests(req, res) {
    try {
      const { studentId, classroomId } = extractStudentIds(req.user);
      const { lessonId, type } = req.query;

      if (!studentId || !classroomId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียนหรือห้องเรียน'
        });
      }

      const tests = await StudentService.getStudentTests(studentId, classroomId, {
        lessonId,
        type
      });

      res.json({
        success: true,
        data: { tests }
      });
    } catch (error) {
      console.error('Get tests error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลแบบทดสอบ'
      });
    }
  }

  static async submitTest(req, res) {
    try {
      const { testId } = req.params;
      const { answers, timeSpent } = req.body;
      const { studentId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const result = await StudentService.submitTest(studentId, testId, answers, timeSpent);

      res.json({
        success: true,
        message: 'ส่งคำตอบสำเร็จ',
        data: {
          testAttempt: result,
          score: result.score,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions
        }
      });
    } catch (error) {
      console.error('Submit test error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการส่งคำตอบ'
      });
    }
  }

  static async getGames(req, res) {
    try {
      const { studentId, classroomId } = extractStudentIds(req.user);
      const { lessonId, type } = req.query;

      if (!studentId || !classroomId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียนหรือห้องเรียน'
        });
      }

      const games = await StudentService.getStudentGames(studentId, classroomId, {
        lessonId,
        type
      });

      res.json({
        success: true,
        data: { games }
      });
    } catch (error) {
      console.error('Get games error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเกม'
      });
    }
  }

  static async submitGame(req, res) {
    try {
      const { gameId } = req.params;
      const { score, level, timeSpent, data } = req.body;
      const { studentId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const gameAttempt = await StudentService.submitGame(studentId, gameId, {
        score,
        level: level || 1,
        timeSpent,
        data
      });

      res.json({
        success: true,
        message: 'บันทึกผลเกมสำเร็จ',
        data: { gameAttempt }
      });
    } catch (error) {
      console.error('Submit game error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการบันทึกผลเกม'
      });
    }
  }

  static async getProgress(req, res) {
    try {
      const { studentId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const progress = await StudentService.getStudentProgress(studentId);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      console.error('Get progress error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลความคืบหน้า'
      });
    }
  }

  static async getNotifications(req, res) {
    try {
      const { studentId } = extractStudentIds(req.user);
      const { unreadOnly = false } = req.query;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const notifications = await StudentService.getStudentNotifications(studentId, unreadOnly === 'true');

      res.json({
        success: true,
        data: { notifications }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน'
      });
    }
  }

  static async markNotificationAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const { studentId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      await StudentService.markNotificationAsRead(studentId, notificationId);

      res.json({
        success: true,
        message: 'อัปเดตสถานะการแจ้งเตือนแล้ว'
      });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ'
      });
    }
  }

  static async markAllNotificationsAsRead(req, res) {
    try {
      const { studentId } = extractStudentIds(req.user);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const result = await StudentService.markAllNotificationsAsRead(studentId);

      res.json({
        success: true,
        message: 'อัปเดตสถานะการแจ้งเตือนทั้งหมดแล้ว',
        data: result
      });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะทั้งหมด'
      });
    }
  }

  /**
   * Save image and detect handwriting (NEW - Recommended)
   */
  static async saveAndDetectHandwriting(req, res) {
    try {
      const { imageData, targetWord } = req.body;
      const { studentId } = extractStudentIds(req.user);

      if (!imageData) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาส่งรูปภาพ'
        });
      }

      if (!targetWord) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุคำที่ต้องการตรวจสอบ'
        });
      }

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      // Validate imageData format
      if (!imageData.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: 'รูปแบบรูปภาพไม่ถูกต้อง'
        });
      }

      // Check for empty canvas (very small base64 data)
      const base64Data = imageData.split(',')[1];
      if (!base64Data || base64Data.length < 100) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาเขียนอักษรบนกระดานก่อนตรวจสอบ'
        });
      }

      // Check if we're on Vercel (read-only filesystem)
      const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
      
      let filePath = null;
      let imageUrl = null;

      // 1. Save image to disk (only if not on Vercel)
      if (!isVercel) {
        try {
          const uploadDir = path.join(__dirname, '..', APP_CONFIG.UPLOAD_PATH || 'public/uploads');
          const writingDir = path.join(uploadDir, 'writing');
          
          // Create directories if they don't exist
          await fs.mkdir(writingDir, { recursive: true });

          // Generate unique filename
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const filename = `writing_${studentId}_${targetWord}_${timestamp}_${randomStr}.png`;
          filePath = path.join(writingDir, filename);

          // Convert base64 to buffer and save
          const imageBuffer = Buffer.from(base64Data, 'base64');
          await fs.writeFile(filePath, imageBuffer);

          // Generate URL (relative path for serving)
          imageUrl = `/uploads/writing/${filename}`;

          console.log('✅ Image saved to disk:', filePath);
          console.log('📷 Image URL:', imageUrl);
        } catch (fileError) {
          console.warn('⚠️ Failed to save image to disk:', fileError.message);
          // Continue without saving to disk - will store base64 in DB instead
        }
      } else {
        console.log('☁️ Running on Vercel - skipping file save (read-only filesystem)');
      }

      // 2. Detect handwriting using AI
      const result = await StudentService.detectHandwritingAI(imageData, targetWord);

      // 3. Save attempt to database
      const writingAttempt = new WritingAttempt({
        studentId,
        targetWord,
        imagePath: filePath || null, // Only set if file was saved
        imageUrl: imageUrl || null, // Only set if file was saved
        imageData: isVercel ? imageData : null, // Store base64 only on Vercel to save DB space
        detectedText: result.detectedText || '',
        isCorrect: result.isCorrect || false,
        confidence: result.confidence || 0,
        explanation: result.explanation || '',
        method: result.method || 'Gemini'
      });

      await writingAttempt.save();

      // 4. Return response
      res.json({
        success: true,
        data: {
          detectedText: result.detectedText,
          isCorrect: result.isCorrect,
          targetWord,
          confidence: result.confidence || 0,
          explanation: result.explanation || '',
          imageUrl: imageUrl || null, // May be null on Vercel
          imageData: isVercel ? imageData : null, // Include base64 if on Vercel
          attemptId: writingAttempt._id,
          method: result.method || 'Gemini'
        }
      });
    } catch (error) {
      console.error('=== Save and Detect Handwriting ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการบันทึกและตรวจสอบลายมือ',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Detect handwriting (Legacy - without saving)
   */
  static async detectHandwriting(req, res) {
    try {
      const { imageData, targetWord } = req.body;

      console.log('=== Detect Handwriting Request ===');
      console.log('Has imageData:', !!imageData);
      console.log('ImageData length:', imageData?.length);
      console.log('Target word:', targetWord);

      if (!imageData) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาส่งรูปภาพ'
        });
      }

      if (!targetWord) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุคำที่ต้องการตรวจสอบ'
        });
      }

      // Validate imageData format
      if (!imageData.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: 'รูปแบบรูปภาพไม่ถูกต้อง'
        });
      }

      // Check for empty canvas (very small base64 data)
      const base64Data = imageData.split(',')[1];
      if (!base64Data || base64Data.length < 100) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาเขียนอักษรบนกระดานก่อนตรวจสอบ'
        });
      }

      // Call AI detection service
      const result = await StudentService.detectHandwritingAI(imageData, targetWord);

      // If detection returns empty string, it means validation failed
      if (!result.detectedText) {
        return res.status(400).json({
          success: false,
          message: result.explanation || 'ไม่สามารถตรวจจับตัวอักษรได้ กรุณาเขียนให้ชัดเจนขึ้น'
        });
      }

      res.json({
        success: true,
        data: {
          detectedText: result.detectedText,
          isCorrect: result.isCorrect,
          targetWord,
          confidence: result.confidence || 0,
          explanation: result.explanation || ''
        }
      });
    } catch (error) {
      console.error('=== Detect Handwriting ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการตรวจสอบลายมือ',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get writing attempts history
   */
  static async getWritingHistory(req, res) {
    try {
      const { studentId } = extractStudentIds(req.user);
      const { limit = 50, offset = 0 } = req.query;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลนักเรียน'
        });
      }

      const attempts = await WritingAttempt.find({ studentId })
        .sort({ createdAt: -1 })
        .limit(Number.parseInt(limit))
        .skip(Number.parseInt(offset))
        .lean();

      // Include imageData for attempts that don't have imageUrl (Vercel storage)
      const attemptsWithImages = attempts.map(attempt => ({
        ...attempt,
        // If no imageUrl but has imageData, include it for frontend to display
        imageData: attempt.imageData || null
      }));

      const total = await WritingAttempt.countDocuments({ studentId });

      res.json({
        success: true,
        data: {
          attempts: attemptsWithImages,
          total,
          limit: Number.parseInt(limit),
          offset: Number.parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Get writing history error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการดึงประวัติการเขียน'
      });
    }
  }

  /**
   * Compare YOLO vs Claude detection
   */
}
