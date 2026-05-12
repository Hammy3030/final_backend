import express from 'express';
import { validate, lessonSchema, testSchema, questionSchema, gameSchema } from '../middleware/validation.js';
import { teacherOnly, classroomAccess } from '../middleware/auth.js';
import { LessonService } from '../services/lessonService.js';

const router = express.Router();

// Get lessons for classroom
router.get('/classrooms/:classroomId', teacherOnly, classroomAccess, async (req, res) => {
  try {
    const lessons = await LessonService.getLessonsByClassroom(req.classroomId, req.user.teacher.id);

    res.json({
      success: true,
      data: { lessons }
    });
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบทเรียน'
    });
  }
});

// Create lesson
router.post('/classrooms/:classroomId', teacherOnly, classroomAccess, validate(lessonSchema), async (req, res) => {
  try {
    const { title, content, audioUrl, imageUrl, order } = req.body;

    const lesson = await LessonService.createLesson({
      title,
      content,
      audioUrl,
      imageUrl,
      orderIndex: order || 0,
      classroomId: req.classroomId,
      teacherId: req.user.teacher.id
    });

    res.status(201).json({
      success: true,
      message: 'สร้างบทเรียนสำเร็จ',
      data: { lesson }
    });
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างบทเรียน'
    });
  }
});

// Update lesson
router.put('/:lessonId', teacherOnly, validate(lessonSchema), async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, content, audioUrl, imageUrl, order, isActive } = req.body;

    const lesson = await LessonService.updateLesson(lessonId, req.user.teacher.id, {
      title,
      content,
      audioUrl,
      imageUrl,
      orderIndex: order,
      isActive
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบบทเรียน'
      });
    }

    res.json({
      success: true,
      message: 'อัปเดตบทเรียนสำเร็จ',
      data: { lesson }
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตบทเรียน'
    });
  }
});

// Delete lesson
router.delete('/:lessonId', teacherOnly, async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await LessonService.deleteLesson(lessonId, req.user.teacher.id);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบบทเรียน'
      });
    }

    res.json({
      success: true,
      message: 'ลบบทเรียนสำเร็จ'
    });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการลบบทเรียน'
    });
  }
});

// Create test for lesson
router.post('/:lessonId/tests', teacherOnly, validate(testSchema), async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, type, timeLimit, passingScore } = req.body;

    const test = await LessonService.createTest(lessonId, req.user.teacher.id, {
      title,
      type,
      timeLimit,
      passingScore
    });

    res.status(201).json({
      success: true,
      message: 'สร้างแบบทดสอบสำเร็จ',
      data: { test }
    });
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการสร้างแบบทดสอบ'
    });
  }
});

// Add question to test
router.post('/tests/:testId/questions', teacherOnly, validate(questionSchema), async (req, res) => {
  try {
    const { testId } = req.params;
    const { question, options, correctAnswer, explanation, imageUrl, audioUrl, imageOptions, isMultipleChoice } = req.body;

    const questionRecord = await LessonService.createQuestion(testId, req.user.teacher.id, {
      question,
      options,
      correctAnswer,
      explanation,
      imageUrl,
      audioUrl,
      imageOptions,
      isMultipleChoice
    });

    res.status(201).json({
      success: true,
      message: 'เพิ่มคำถามสำเร็จ',
      data: { question: questionRecord }
    });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการเพิ่มคำถาม'
    });
  }
});

// Create game for lesson
router.post('/:lessonId/games', teacherOnly, validate(gameSchema), async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, type, settings } = req.body;

    const game = await LessonService.createGame(lessonId, req.user.teacher.id, {
      title,
      type,
      settings
    });

    res.status(201).json({
      success: true,
      message: 'สร้างเกมสำเร็จ',
      data: { game }
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการสร้างเกม'
    });
  }
});

// Get lesson details with tests and games
router.get('/:lessonId', async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await LessonService.getLessonById(lessonId);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบบทเรียน'
      });
    }

    res.json({
      success: true,
      data: { lesson }
    });
  } catch (error) {
    console.error('Get lesson details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลบทเรียน'
    });
  }
});

// Get test details
router.get('/tests/:testId', async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await LessonService.getTestById(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบแบบทดสอบ'
      });
    }

    res.json({
      success: true,
      data: { test }
    });
  } catch (error) {
    console.error('Get test details error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลแบบทดสอบ'
    });
  }
});

// Get game details
router.get('/games/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    const game = await LessonService.getGameById(gameId);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบเกม'
      });
    }

    res.json({
      success: true,
      data: { game }
    });
  } catch (error) {
    console.error('Get game details error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเกม'
    });
  }
});

export default router;
