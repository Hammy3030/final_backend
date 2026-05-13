import { DatabaseService } from './databaseService.js';
import { AuthService } from './authService.js';
import { Student } from '../models/Student.js';
import { User } from '../models/User.js';
import { Classroom } from '../models/Classroom.js';
import { LessonProgress } from '../models/LessonProgress.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { GameAttempt } from '../models/GameAttempt.js';
import { Lesson } from '../models/Lesson.js';
import { Test } from '../models/Test.js';
import { Game } from '../models/Game.js';

export class ClassroomService {
  static async createClassroom(teacherId, classroomData) {
    const nameTrimmed = (classroomData.name || '').trim();
    if (!nameTrimmed) {
      throw new Error('กรุณากรอกชื่อห้องเรียน');
    }
    const existing = await Classroom.findOne({
      teacherId,
      name: { $regex: new RegExp(`^${nameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existing) {
      throw new Error('ชื่อห้องเรียนซ้ำ กรุณาใช้ชื่ออื่น');
    }
    return await DatabaseService.createClassroom({
      name: nameTrimmed,
      description: classroomData.description || '',
      teacher_id: teacherId
    });
  }

  static async getClassroomsByTeacher(teacherId) {
    const classrooms = await DatabaseService.getClassroomsByTeacher(teacherId);

    // Format response to match expected structure
    return classrooms.map(classroom => ({
      ...classroom,
      students: [{ count: classroom._count?.students || 0 }],
      lessons: [{ count: classroom._count?.lessons || 0 }]
    }));
  }

  static async getClassroomById(classroomId) {
    return await DatabaseService.getClassroomById(classroomId);
  }

  static async updateClassroom(classroomId, teacherId, classroomData) {
    const classroom = await DatabaseService.getClassroomById(classroomId);
    if (!classroom) {
      throw new Error('ไม่พบห้องเรียน');
    }
    if (classroom.teacherId.toString() !== teacherId.toString()) {
      throw new Error('คุณไม่มีสิทธิ์แก้ไขห้องเรียนนี้');
    }
    const nameTrimmed = (classroomData.name || '').trim();
    if (nameTrimmed) {
      const existing = await Classroom.findOne({
        teacherId,
        _id: { $ne: classroomId },
        name: { $regex: new RegExp(`^${nameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (existing) {
        throw new Error('ชื่อห้องเรียนซ้ำ กรุณาใช้ชื่ออื่น');
      }
    }
    return await DatabaseService.updateClassroom(classroomId, {
      name: nameTrimmed || classroom.name,
      description: classroomData.description !== undefined ? classroomData.description : classroom.description
    });
  }

  static async deleteClassroom(classroomId, teacherId) {
    // Verify ownership
    const classroom = await DatabaseService.getClassroomById(classroomId);
    if (!classroom) {
      throw new Error('ไม่พบห้องเรียน');
    }
    if (classroom.teacherId.toString() !== teacherId.toString()) {
      throw new Error('คุณไม่มีสิทธิ์ลบห้องเรียนนี้');
    }

    // Use DatabaseService to perform hard & cascade delete
    await DatabaseService.deleteClassroom(classroomId);
    return { success: true };
  }

  static async addStudentsToClassroom(classroomId, studentsData) {
    const createdStudents = [];
    const createdUserIds = [];

    // Get the highest sequence number currently in this room to avoid duplicates if students were deleted
    const lastStudent = await Student.findOne({ classroomId }).sort({ studentCode: -1 });
    let lastSeq = 0;
    if (lastStudent && lastStudent.studentCode) {
      const match = lastStudent.studentCode.match(/-(\d+)$/);
      if (match) {
        lastSeq = parseInt(match[1], 10);
      }
    }

    const classroom = await Classroom.findById(classroomId);
    let roomCode = String(classroomId).slice(-2).toLowerCase();
    if (classroom) {
      const digits = classroom.name.replace(/\D/g, '');
      if (digits) roomCode = digits;
    }

    try {
      for (let i = 0; i < studentsData.length; i++) {
        const studentData = studentsData[i];
        
        // 1. Check if student with same name already exists in THIS classroom
        const nameTrimmed = (studentData.name || '').trim();
        const existingStudent = await Student.findOne({ 
          classroomId, 
          name: { $regex: new RegExp(`^${nameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        });
        
        if (existingStudent) {
          throw new Error(`นักเรียนชื่อ "${nameTrimmed}" มีอยู่ในห้องเรียนนี้แล้ว`);
        }

        // Use the next sequence number based on the highest found
        const studentCodeNumber = String(lastSeq + createdStudents.length + 1).padStart(3, '0');
        const studentCode = `stu${roomCode}-${studentCodeNumber}`;
        const email = `${studentCode}@bearthai.local`;
        
        // 2. Double check if USER with this email already exists (Safety check for E11000)
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          // If user exists, we must increment and try again until we find a free one
          // This handles cases where student records were partially deleted
          let jump = 1;
          let newEmail = email;
          let newCode = studentCode;
          while (await User.findOne({ email: newEmail })) {
            const nextNum = String(lastSeq + createdStudents.length + 1 + jump).padStart(3, '0');
            newCode = `stu${roomCode}-${nextNum}`;
            newEmail = `${newCode}@bearthai.local`;
            jump++;
          }
          // Use the free one found
          const finalUser = await DatabaseService.createUser({
            email: newEmail,
            password: await AuthService.hashPassword('default123'),
            role: 'STUDENT',
            name: studentData.name,
            school: studentData.school,
            isEmailVerified: true
          });
          createdUserIds.push(finalUser._id || finalUser.id);
          const student = await DatabaseService.createStudent({
            user_id: finalUser._id || finalUser.id,
            classroom_id: classroomId,
            student_code: newCode,
            qr_code: newCode,
            name: studentData.name,
            first_name: studentData.firstName,
            last_name: studentData.lastName
          });
          createdStudents.push({ ...student, qrCode: newCode });
          continue;
        }

        const qrCode = studentCode;
        const defaultPassword = 'default123';
        const hashedPassword = await AuthService.hashPassword(defaultPassword);

        const user = await DatabaseService.createUser({
          email: email,
          password: hashedPassword,
          role: 'STUDENT',
          name: studentData.name,
          school: studentData.school,
          isEmailVerified: true
        });
        createdUserIds.push(user._id || user.id);

        const student = await DatabaseService.createStudent({
          user_id: user._id || user.id,
          classroom_id: classroomId,
          student_code: studentCode,
          qr_code: qrCode,
          name: studentData.name,
          first_name: studentData.firstName,
          last_name: studentData.lastName
        });

        createdStudents.push({ ...student, qrCode });
      }
      return createdStudents;
    } catch (err) {
      // Rollback newly created users if we hit an error
      for (const uid of createdUserIds) {
        try {
          await User.findByIdAndDelete(uid);
        } catch (e) {
          console.error('Rollback: failed to delete user', uid, e);
        }
      }
      throw err;
    }
  }

  static async createStudentsWithoutClassroom(teacherId, studentsData) {
    const createdStudents = [];
    const createdUserIds = [];
    const existingStudentsCount = await Student.countDocuments();

    try {
      for (let i = 0; i < studentsData.length; i++) {
        const studentData = studentsData[i];
        const studentCodeNumber = String(existingStudentsCount + i + 1).padStart(3, '0');
        const studentCode = `STU${studentCodeNumber}`;
        const qrCode = studentCode;
        const defaultPassword = 'default123';
        const hashedPassword = await AuthService.hashPassword(defaultPassword);

        const user = await DatabaseService.createUser({
          email: `${studentCode}@bearthai.local`,
          password: hashedPassword,
          role: 'STUDENT',
          name: studentData.name,
          school: studentData.school,
          isEmailVerified: true
        });
        createdUserIds.push(user._id || user.id);

        const student = await DatabaseService.createStudent({
          user_id: user._id || user.id,
          classroom_id: null,
          student_code: studentCode,
          qr_code: qrCode,
          name: studentData.name,
          first_name: studentData.firstName,
          last_name: studentData.lastName
        });

        createdStudents.push({ ...student, qrCode });
      }
      return createdStudents;
    } catch (err) {
      for (const uid of createdUserIds) {
        try {
          await User.findByIdAndDelete(uid);
        } catch (e) {
          console.error('Rollback: failed to delete user', uid, e);
        }
      }
      throw err;
    }
  }

  static async searchStudents(query) {
    const { Student } = await import('../models/Student.js');

    // Safety check for empty query
    if (!query || query.trim().length === 0) return [];

    const searchRegex = new RegExp(query, 'i');

    // Search by name, student code, or QR code
    const students = await Student.find({
      $or: [
        { name: searchRegex },
        { studentCode: searchRegex },
        { qrCode: searchRegex }
      ]
    }).populate('classroomId', 'name');

    return students.map(s => s.toObject());
  }

  static async assignStudentsToClassroom(classroomId, studentIds) {
    const { Student } = await import('../models/Student.js');
    const { Classroom } = await import('../models/Classroom.js');

    // Verify classroom exists
    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      throw new Error('ไม่พบห้องเรียน');
    }

    const results = [];
    const errors = [];

    for (const studentId of studentIds) {
      try {
        const student = await Student.findByIdAndUpdate(
          studentId,
          { classroomId: classroom._id },
          { new: true }
        );

        if (student) {
          results.push(student.toObject());
        } else {
          errors.push(`Student not found: ${studentId}`);
        }
      } catch (error) {
        errors.push(`Error assigning student ${studentId}: ${error.message}`);
      }
    }

    return { results, errors };
  }

  static async removeStudentFromClassroom(classroomId, studentId) {
    // Hard delete: Remove student completely from database and all related data
    const { WritingAttempt } = await import('../models/WritingAttempt.js');
    const { LessonProgress } = await import('../models/LessonProgress.js');
    const { TestAttempt } = await import('../models/TestAttempt.js');
    const { GameAttempt } = await import('../models/GameAttempt.js');
    const { Notification } = await import('../models/Notification.js');
    const { User } = await import('../models/User.js');
    
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('ไม่พบนักเรียน');
    }

    // 1. Delete all writing attempts
    await WritingAttempt.deleteMany({ studentId });

    // 2. Delete all lesson progress
    await LessonProgress.deleteMany({ studentId });

    // 3. Delete all test attempts
    await TestAttempt.deleteMany({ studentId });

    // 4. Delete all game attempts
    await GameAttempt.deleteMany({ studentId });

    // 5. Delete all notifications
    await Notification.deleteMany({ studentId });

    // 6. Delete associated user (prevent orphan in User collection)
    if (student.userId) {
      await User.findByIdAndDelete(student.userId);
    } else if (student.studentCode) {
      const email = `${student.studentCode}@bearthai.local`;
      await User.findOneAndDelete({ email, role: 'STUDENT' });
    }

    // 7. Finally delete student
    await Student.findByIdAndDelete(studentId);

    // 8. Re-sequence remaining students in the classroom (ID Re-sequencing Logic)
    const remainingStudents = await Student.find({ classroomId }).sort({ createdAt: 1 });
    const classroom = await Classroom.findById(classroomId);
    let roomCode = String(classroomId).slice(-2).toLowerCase();
    if (classroom) {
      const digits = classroom.name.replace(/\D/g, '');
      if (digits) roomCode = digits;
    }
    
    for (let i = 0; i < remainingStudents.length; i++) {
      const st = remainingStudents[i];
      const newSequenceNumber = String(i + 1).padStart(3, '0');
      const newStudentCode = `stu${roomCode}-${newSequenceNumber}`;
      
      if (st.studentCode !== newStudentCode) {
        st.studentCode = newStudentCode;
        st.qrCode = newStudentCode;
        await st.save();
        
        // Update the User email
        if (st.userId) {
          const user = await User.findById(st.userId);
          if (user) {
            user.email = `${newStudentCode}@bearthai.local`;
            await user.save();
          }
        }
      }
    }

    return { success: true };
  }

  static async resetStudentPassword(classroomId, studentId) {
    // Generate new password
    const newPassword = Math.random().toString(36).substr(2, 8);
    const hashedPassword = await AuthService.hashPassword(newPassword);

    // Get student to find user_id
    const student = await Student.findById(studentId);

    if (!student) {
      throw new Error('ไม่พบนักเรียน');
    }

    // Update password in users table
    await User.findByIdAndUpdate(student.userId, { password: hashedPassword });

    return newPassword;
  }

  static async getClassroomReports(classroomId, type = 'overview') {
    const classroom = await this.getClassroomById(classroomId);

    if (type === 'overview') {
      // Get students with their progress summary
      const students = await Student.find({ classroomId }).populate('userId');

      const studentsWithCounts = await Promise.all(students.map(async (student) => {
        const lessonProgressCount = await LessonProgress.countDocuments({ studentId: student._id });
        const completedLessonsCount = await LessonProgress.countDocuments({ studentId: student._id, isCompleted: true });
        const testAttemptsCount = await TestAttempt.countDocuments({ studentId: student._id });
        const gameAttemptsCount = await GameAttempt.countDocuments({ studentId: student._id });

        // Calculate average test score
        const testAttempts = await TestAttempt.find({ studentId: student._id });
        const averageScore = testAttempts.length > 0
          ? Math.round(testAttempts.reduce((sum, ta) => sum + (ta.score || 0), 0) / testAttempts.length)
          : 0;

        return {
          id: student._id.toString(),
          name: student.name,
          student_code: student.studentCode,
          lesson_progress: [{ count: lessonProgressCount }],
          completed_lessons: [{ count: completedLessonsCount }],
          test_attempts: [{ count: testAttemptsCount }],
          game_attempts: [{ count: gameAttemptsCount }],
          average_test_score: averageScore
        };
      }));

      return {
        ...classroom,
        students: studentsWithCounts
      };
    } else if (type === 'detailed') {
      // Get detailed progress for each student
      const students = await Student.find({ classroomId }).populate('userId');

      const studentsWithProgress = await Promise.all(students.map(async (student) => {
        const lessonProgress = await LessonProgress.find({ studentId: student._id }).populate('lessonId');
        const testAttempts = await TestAttempt.find({ studentId: student._id }).populate('testId');
        const gameAttempts = await GameAttempt.find({ studentId: student._id }).populate('gameId');

        // Calculate statistics
        const completedLessons = lessonProgress.filter(lp => lp.isCompleted).length;
        const totalLessons = await Lesson.find({ classroomId, isDeleted: false, isActive: true }).countDocuments();
        const averageScore = testAttempts.length > 0
          ? Math.round(testAttempts.reduce((sum, ta) => sum + (ta.score || 0), 0) / testAttempts.length)
          : 0;
        const passedTests = testAttempts.filter(ta => ta.isPassed).length;

        return {
          ...student.toObject(),
          lessonProgress: lessonProgress.map(lp => lp.toObject()),
          testAttempts: testAttempts.map(ta => ta.toObject()),
          gameAttempts: gameAttempts.map(ga => ga.toObject()),
          statistics: {
            completedLessons,
            totalLessons,
            averageScore,
            passedTests,
            totalTestAttempts: testAttempts.length,
            totalGameAttempts: gameAttempts.length
          }
        };
      }));

      return {
        ...classroom,
        students: studentsWithProgress
      };
    }

    throw new Error('ประเภทรายงานไม่ถูกต้อง');
  }

  static async getStudentDetailedProgress(classroomId, studentId) {
    // Verify student belongs to classroom
    const student = await Student.findOne({ _id: studentId, classroomId }).populate('userId');
    if (!student) {
      throw new Error('ไม่พบนักเรียนหรือนักเรียนไม่อยู่ในห้องเรียนนี้');
    }

    // Get all lessons for this classroom
    const lessons = await Lesson.find({ classroomId, isDeleted: false, isActive: true }).sort({ orderIndex: 1 });

    // Get lesson progress (only for lessons in this classroom that are not deleted)
    const lessonIds = lessons.map(l => l._id);
    const lessonProgress = await LessonProgress.find({ 
      studentId, 
      lessonId: { $in: lessonIds }
    }).populate({
      path: 'lessonId',
      match: { isDeleted: false, isActive: true }
    });

    // Filter out progress with null lessonId (deleted lessons)
    const validLessonProgress = lessonProgress.filter(lp => lp.lessonId);

    // Get test attempts with test details (excluding deleted tests)
    const testAttempts = await TestAttempt.find({ studentId })
      .populate({
        path: 'testId',
        match: { isDeleted: false },
        populate: { 
          path: 'lessonId',
          match: { isDeleted: false }
        }
      })
      .sort({ completedAt: -1 })
      .lean();

    // Filter out attempts with null testId (deleted tests)
    const validTestAttempts = testAttempts.filter(attempt => attempt.testId && attempt.testId.lessonId);

    // Get game attempts (excluding deleted games)
    const gameAttempts = await GameAttempt.find({ studentId })
      .populate({
        path: 'gameId',
        match: { isDeleted: false },
        populate: { 
          path: 'lessonId',
          match: { isDeleted: false }
        }
      })
      .sort({ completedAt: -1 })
      .lean();

    // Filter out attempts with null gameId (deleted games)
    const validGameAttempts = gameAttempts.filter(attempt => attempt.gameId && attempt.gameId.lessonId);

    // Create lesson progress map
    const progressMap = new Map();
    validLessonProgress.forEach(lp => {
      progressMap.set(lp.lessonId?._id?.toString() || lp.lessonId?.toString(), lp);
    });

    // Map lessons with progress
    const lessonsWithProgress = lessons.map(lesson => {
      const progress = progressMap.get(lesson._id.toString());
      return {
        ...lesson.toObject(),
        progress: progress ? {
          isCompleted: progress.isCompleted,
          hasPassedPreTest: progress.hasPassedPreTest,
          hasPassedPostTest: progress.hasPassedPostTest,
          completedAt: progress.completedAt,
          timeSpent: progress.timeSpent
        } : null
      };
    });

    // Group test attempts by test
    const testAttemptsByTest = {};
    validTestAttempts.forEach(attempt => {
      const testId = attempt.testId?._id?.toString() || attempt.testId?.id;
      if (testId && attempt.testId) {
        if (!testAttemptsByTest[testId]) {
          testAttemptsByTest[testId] = {
            test: attempt.testId,
            attempts: []
          };
        }
        testAttemptsByTest[testId].attempts.push(attempt);
      }
    });

    // Calculate statistics
    const completedLessons = validLessonProgress.filter(lp => lp.isCompleted).length;
    const totalLessons = lessons.length;
    const averageScore = validTestAttempts.length > 0
      ? Math.round(validTestAttempts.reduce((sum, ta) => sum + (ta.score || 0), 0) / validTestAttempts.length)
      : 0;
    const passedTests = validTestAttempts.filter(ta => ta.isPassed).length;
    const averageGameScore = validGameAttempts.length > 0
      ? Math.round(validGameAttempts.reduce((sum, ga) => sum + (ga.score || 0), 0) / validGameAttempts.length)
      : 0;

    return {
      student: student.toObject(),
      lessons: lessonsWithProgress,
      testAttempts: Object.values(testAttemptsByTest),
      gameAttempts: validGameAttempts,
      statistics: {
        completedLessons,
        totalLessons,
        completionRate: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        averageTestScore: averageScore,
        passedTests,
        totalTestAttempts: validTestAttempts.length,
        averageGameScore,
        totalGameAttempts: validGameAttempts.length
      }
    };
  }

  static async getClassroomStudents(classroomId, filters = {}) {
    const mongoose = (await import('mongoose')).default;
    const { 
      search, 
      gender, 
      progress, 
      testStatus, 
      scoreLevel, 
      gameStatus,
      sort 
    } = filters;

    const classroomObjectId = new mongoose.Types.ObjectId(classroomId);

    // Get total lessons count for progress calculation
    const totalLessons = await Lesson.countDocuments({ 
      classroomId: classroomObjectId, 
      isDeleted: false, 
      isActive: true 
    });

    const pipeline = [
      { $match: { classroomId: classroomObjectId } },
      // Lookup LessonProgress
      {
        $lookup: {
          from: 'lesson_progress',
          localField: '_id',
          foreignField: 'studentId',
          as: 'progress'
        }
      },
      // Lookup TestAttempts with Test details for categorization
      {
        $lookup: {
          from: 'test_attempts',
          let: { student_id: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$studentId', '$$student_id'] } } },
            {
              $lookup: {
                from: 'tests',
                localField: 'testId',
                foreignField: '_id',
                as: 'testInfo'
              }
            },
            { $unwind: '$testInfo' }
          ],
          as: 'testAttemptsDetails'
        }
      },
      // Keep simple testAttempts for easy calculations
      {
        $lookup: {
          from: 'test_attempts',
          localField: '_id',
          foreignField: 'studentId',
          as: 'testAttempts'
        }
      },
      // Lookup GameAttempts
      {
        $lookup: {
          from: 'game_attempts',
          localField: '_id',
          foreignField: 'studentId',
          as: 'gameAttempts'
        }
      },
      // Add calculated fields
      {
        $addFields: {
          completedLessonsCount: {
            $size: {
              $filter: {
                input: '$progress',
                as: 'p',
                cond: { $eq: ['$$p.isCompleted', true] }
              }
            }
          },
          hasPreTest: {
            $or: [
              // Check if attempted any PRE_TEST
              { $gt: [{ $size: { $filter: { input: '$testAttemptsDetails', as: 'ta', cond: { $eq: ['$$ta.testInfo.type', 'PRE_TEST'] } } } }, 0] },
              // Check if attempted any POST_TEST (implies pre-test done or skipped)
              { $gt: [{ $size: { $filter: { input: '$testAttemptsDetails', as: 'ta', cond: { $eq: ['$$ta.testInfo.type', 'POST_TEST'] } } } }, 0] },
              // Fallback to progress records
              { $gt: [{ $size: { $filter: { input: '$progress', as: 'p', cond: { $or: [{ $eq: ['$$p.hasPassedPreTest', true] }, { $eq: ['$$p.hasPassedPostTest', true] }, { $eq: ['$$p.isCompleted', true] }] } } } }, 0] }
            ]
          },
          hasPostTest: {
            $or: [
              // Check if attempted any POST_TEST
              { $gt: [{ $size: { $filter: { input: '$testAttemptsDetails', as: 'ta', cond: { $eq: ['$$ta.testInfo.type', 'POST_TEST'] } } } }, 0] },
              // Fallback to progress records
              { $gt: [{ $size: { $filter: { input: '$progress', as: 'p', cond: { $eq: ['$$p.hasPassedPostTest', true] } } } }, 0] }
            ]
          },
          avgTestScore: {
            $cond: [
              { $gt: [{ $size: '$testAttempts' }, 0] },
              { $avg: '$testAttempts.score' },
              0
            ]
          },
          avgGameScore: {
            $cond: [
              { $gt: [{ $size: '$gameAttempts' }, 0] },
              { $avg: '$gameAttempts.score' },
              0
            ]
          },
          playedTest: { $gt: [{ $size: '$testAttempts' }, 0] },
          playedGame: { $gt: [{ $size: '$gameAttempts' }, 0] },
          completionRate: {
            $cond: [
              { $gt: [totalLessons, 0] },
              { $multiply: [{ $divide: [{ $size: { $filter: { input: '$progress', as: 'p', cond: { $eq: ['$$p.isCompleted', true] } } } }, totalLessons] }, 100] },
              0
            ]
          }
        }
      }
    ];

    // Apply Filters
    const matchFilters = {};

    if (search) {
      matchFilters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentCode: { $regex: search, $options: 'i' } },
        { qrCode: { $regex: search, $options: 'i' } }
      ];
    }

    if (gender && gender !== 'all') {
      if (gender === 'male') {
        matchFilters.name = { $regex: /^(เด็กชาย|ด\.ช\.)/, $options: 'i' };
      } else if (gender === 'female') {
        matchFilters.name = { $regex: /^(เด็กหญิง|ด\.ญ\.)/, $options: 'i' };
      }
    }

    if (progress && progress !== 'all') {
      if (progress === 'no-progress') {
        matchFilters.completedLessonsCount = 0;
      } else if (progress === 'in-progress') {
        matchFilters.completedLessonsCount = { $gt: 0 };
        matchFilters.completionRate = { $lt: 100 };
      } else if (progress === 'completed') {
        matchFilters.completionRate = 100;
      }
    }

    if (testStatus && testStatus !== 'all') {
      if (testStatus === 'pre-done') {
        matchFilters.hasPreTest = true;
      } else if (testStatus === 'post-done') {
        matchFilters.hasPostTest = true;
      } else if (testStatus === 'none') {
        matchFilters.hasPreTest = false;
        matchFilters.hasPostTest = false;
      }
    }

    if (scoreLevel && scoreLevel !== 'all') {
      if (scoreLevel === 'excellent') {
        matchFilters.avgTestScore = { $gte: 80 };
      } else if (scoreLevel === 'passed') {
        matchFilters.avgTestScore = { $gte: 50, $lt: 80 };
      } else if (scoreLevel === 'care') {
        matchFilters.avgTestScore = { $lt: 50 };
        matchFilters.playedTest = true;
      }
    }

    if (gameStatus && gameStatus !== 'all') {
      if (gameStatus === 'played') {
        matchFilters.playedGame = true;
      } else if (gameStatus === 'not-played') {
        matchFilters.playedGame = false;
      }
    }

    if (Object.keys(matchFilters).length > 0) {
      pipeline.push({ $match: matchFilters });
    }

    // Apply Sorting
    let sortStage = { name: 1 };
    if (sort) {
      switch (sort) {
        case 'progress-desc': sortStage = { completionRate: -1 }; break;
        case 'progress-asc': sortStage = { completionRate: 1 }; break;
        case 'test-desc': sortStage = { avgTestScore: -1 }; break;
        case 'game-desc': sortStage = { avgGameScore: -1 }; break;
        case 'name-desc': sortStage = { name: -1 }; break;
        case 'name-asc': sortStage = { name: 1 }; break;
        case 'studentId-asc': sortStage = { studentCode: 1 }; break;
        case 'studentId-desc': sortStage = { studentCode: -1 }; break;
        default: sortStage = { name: 1 };
      }
    }
    pipeline.push({ $sort: sortStage });

    const students = await Student.aggregate(pipeline);

    // Prepare response data with progressSummary structure expected by frontend
    const formattedStudents = students.map(s => ({
      ...s,
      id: s._id.toString(),
      progressSummary: {
        completedLessons: s.completedLessonsCount,
        totalLessons: totalLessons,
        completionRate: Math.round(s.completionRate || 0),
        averageTestScore: Math.round(s.avgTestScore || 0),
        totalTestAttempts: s.testAttempts.length,
        hasPreTest: s.hasPreTest,
        hasPostTest: s.hasPostTest,
        playedGame: s.playedGame,
        avgGameScore: Math.round(s.avgGameScore || 0)
      }
    }));

    return {
      students: formattedStudents,
      totalCount: await Student.countDocuments({ classroomId: classroomObjectId }),
      filteredCount: students.length
    };
  }
}

