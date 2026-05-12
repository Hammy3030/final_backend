import express from 'express';
import {
  validate,
  classroomSchema,
  bulkStudentSchema,
  lessonSchema,
  testSchema,
  gameSchema,
  announcementSchema,
  assignStudentsSchema,
  lessonReorderSchema,
  lessonOrderBodySchema,
  teacherQuestionBodySchema
} from '../middleware/validation.js';
import { teacherOnly, classroomAccess } from '../middleware/auth.js';
import { TeacherController } from '../controllers/teacherController.js';
import multer from 'multer';

// ใช้ Memory Storage เพราะเราส่ง Buffer ให้ Gemini โดยตรง ไม่ต้องเซฟลงดิสก์
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Get teacher's classrooms
router.get('/classrooms', teacherOnly, TeacherController.getClassrooms);

// Update teacher profile
router.put('/profile', teacherOnly, TeacherController.updateProfile);

// Create new classroom
router.post('/classrooms', teacherOnly, validate(classroomSchema), TeacherController.createClassroom);

// Get classroom details
router.get('/classrooms/:classroomId', teacherOnly, classroomAccess, TeacherController.getClassroom);

// Get classroom tests with filters
router.get('/classrooms/:classroomId/tests', teacherOnly, classroomAccess, TeacherController.getTests);

// Get classroom games with filters
router.get('/classrooms/:classroomId/games', teacherOnly, classroomAccess, TeacherController.getGames);

// Update classroom
router.put('/classrooms/:classroomId', teacherOnly, classroomAccess, validate(classroomSchema), TeacherController.updateClassroom);

// Delete classroom
router.delete('/classrooms/:classroomId', teacherOnly, classroomAccess, TeacherController.deleteClassroom);

// Search students
router.get('/students/search', teacherOnly, TeacherController.searchStudents);

// Create students (with or without classroom)
router.post('/students', teacherOnly, validate(bulkStudentSchema), TeacherController.createStudents);

// Add students to classroom (bulk)
router.post('/classrooms/:classroomId/students', teacherOnly, classroomAccess, validate(bulkStudentSchema), TeacherController.addStudents);

// Get classroom students with filters
router.get('/classrooms/:classroomId/students', teacherOnly, classroomAccess, TeacherController.getClassroomStudents);

// Import students from PDF
router.post(
  '/classrooms/:classroomId/students/import-pdf',
  teacherOnly,
  classroomAccess,
  upload.single('file'),
  TeacherController.importStudentsFromPdf
);

// Assign existing students to classroom
router.post(
  '/classrooms/:classroomId/students/assign',
  teacherOnly,
  classroomAccess,
  validate(assignStudentsSchema),
  TeacherController.assignStudents
);

// Remove student from classroom
router.delete('/classrooms/:classroomId/students/:studentId', teacherOnly, classroomAccess, TeacherController.removeStudent);

// Reset student password
router.post('/classrooms/:classroomId/students/:studentId/reset-password', teacherOnly, classroomAccess, TeacherController.resetStudentPassword);

// Get classroom reports
router.get('/classrooms/:classroomId/reports', teacherOnly, classroomAccess, TeacherController.getClassroomReports);

// Get detailed student progress
router.get('/classrooms/:classroomId/students/:studentId/progress', teacherOnly, classroomAccess, TeacherController.getStudentProgress);

// Create announcement
router.post(
  '/classrooms/:classroomId/announcements',
  teacherOnly,
  classroomAccess,
  validate(announcementSchema),
  TeacherController.createAnnouncement
);

// Get lessons for classroom
router.get('/classrooms/:classroomId/lessons', teacherOnly, classroomAccess, TeacherController.getLessons);

// Create lesson
router.post('/classrooms/:classroomId/lessons', teacherOnly, classroomAccess, validate(lessonSchema), TeacherController.createLesson);

// Reorder lessons (must be before /lessons/:lessonId route)
router.put('/lessons/reorder', teacherOnly, validate(lessonReorderSchema), TeacherController.reorderLessons);

// Update lesson
router.put('/lessons/:lessonId', teacherOnly, validate(lessonSchema), TeacherController.updateLesson);

// Delete lesson (soft delete)
router.delete('/lessons/:lessonId', teacherOnly, TeacherController.deleteLesson);

// Restore lesson
router.post('/lessons/:lessonId/restore', teacherOnly, TeacherController.restoreLesson);

// Update test
router.put('/tests/:testId', teacherOnly, TeacherController.updateTest);

// Delete test (soft delete)
router.delete('/tests/:testId', teacherOnly, TeacherController.deleteTest);

// Restore test
router.post('/tests/:testId/restore', teacherOnly, TeacherController.restoreTest);

// Update game
router.put('/games/:gameId', teacherOnly, TeacherController.updateGame);

// Delete game (soft delete)
router.delete('/games/:gameId', teacherOnly, TeacherController.deleteGame);

// Restore game
router.post('/games/:gameId/restore', teacherOnly, TeacherController.restoreGame);

// Get deleted items for a classroom
router.get('/classrooms/:classroomId/deleted', teacherOnly, classroomAccess, TeacherController.getDeletedItems);

// Generate lessons for all classrooms
router.post('/lessons/generate-all', teacherOnly, TeacherController.generateLessonsForAllClassrooms);

// Generate tests for lesson
router.post('/lessons/:lessonId/tests/generate', teacherOnly, TeacherController.generateTests);

// Generate games for lesson
router.post('/lessons/:lessonId/games/generate', teacherOnly, TeacherController.generateGames);

// Create test for lesson
router.post('/lessons/:lessonId/tests', teacherOnly, validate(testSchema), TeacherController.createTest);

// Add question to test
router.post(
  '/tests/:testId/questions',
  teacherOnly,
  validate(teacherQuestionBodySchema),
  TeacherController.addQuestion
);

// Create game for lesson
router.post('/lessons/:lessonId/games', teacherOnly, validate(gameSchema), TeacherController.createGame);



// Generate default lessons for classroom
router.post('/classrooms/:classroomId/lessons/generate', teacherOnly, classroomAccess, TeacherController.generateLessons);

// Update lesson order
router.put(
  '/lessons/:lessonId/order',
  teacherOnly,
  validate(lessonOrderBodySchema),
  TeacherController.updateLessonOrder
);

export default router;
