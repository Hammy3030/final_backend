import mongoose from 'mongoose';
import { DatabaseService } from './databaseService.js';
import { Lesson } from '../models/Lesson.js';
import { Test } from '../models/Test.js';
import { Game } from '../models/Game.js';
import { Question } from '../models/Question.js';
import { LessonProgress } from '../models/LessonProgress.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { GameAttempt } from '../models/GameAttempt.js';
import { Notification } from '../models/Notification.js';
import { Student } from '../models/Student.js';

export class StudentService {
  static async getStudentLessons(studentId, classroomId) {
    try {
      // Validate inputs
      if (!studentId) {
        throw new Error('Student ID is required');
      }
      if (!classroomId) {
        throw new Error('Classroom ID is required');
      }

      // Get lessons with progress, tests, and games
      const lessons = await Lesson.find({
        classroomId,
        isActive: true,
        isDeleted: false
      }).sort({ orderIndex: 1 }).maxTimeMS(30000); // 30 second timeout

      // AUTO-FIX: Update old path `/คำศัพท์บท1-4/` to `/คำศัพท์บท1-8/`
      for (const lesson of lessons) {
        if (lesson.content && lesson.content.includes('/คำศัพท์บท1-4/')) {
          console.log(`Auto-updating lesson ${lesson.orderIndex} path from /คำศัพท์บท1-4/ to /คำศัพท์บท1-8/`);
          const updatedContent = lesson.content.replaceAll('/คำศัพท์บท1-4/', '/คำศัพท์บท1-8/');
          lesson.content = updatedContent;
          try {
            await Lesson.updateOne({ _id: lesson._id || lesson.id }, { content: updatedContent });
          } catch (e) {
            console.error('Failed to update lesson path:', e);
          }
        }
      }

      // Get all progress records for this student in one query
      const allProgress = await LessonProgress.find({ studentId });
      const progressMap = new Map();
      allProgress.forEach(p => {
        progressMap.set(p.lessonId.toString(), p);
      });

      const results = await Promise.all(lessons.map(async (lesson, index) => {
        const progress = progressMap.get(lesson._id.toString());

        const tests = await Test.find({
          lessonId: lesson._id,
          isActive: true,
          isDeleted: false
        });

        const testsWithAttempts = await Promise.all(tests.map(async (testItem) => {
          const attempts = await TestAttempt.find({
            testId: testItem._id,
            studentId
          });
          return { ...testItem.toObject(), testAttempts: attempts.map(a => a.toObject()) };
        }));

        const games = await Game.find({
          lessonId: lesson._id,
          isActive: true,
          isDeleted: false
        });

        const gamesWithAttempts = await Promise.all(games.map(async (gameItem) => {
          const attempts = await GameAttempt.find({
            gameId: gameItem._id,
            studentId
          });
          return { ...gameItem.toObject(), gameAttempts: attempts.map(a => a.toObject()) };
        }));

        const preTest = testsWithAttempts.find(t => t.type === 'PRE_TEST');
        const postTest = testsWithAttempts.find(t => t.type === 'POST_TEST');

        let status = 'LOCKED';
        let canAccess = false;

        const preTestAttempts = preTest?.testAttempts || [];
        const postTestAttempts = postTest?.testAttempts || [];

        // Pretest: ถ้ามีการทำแล้วถือว่าผ่าน (ไม่ต้องผ่านเกณฑ์)
        const preTestCompleted = preTestAttempts.length > 0;
        const lessonCompleted = progress?.isCompleted === true;
        // Posttest: ต้องผ่านเกณฑ์ (hasPassedPostTest = true)
        const postTestCompleted = progress?.hasPassedPostTest === true;
        const gamesCompleted = gamesWithAttempts.every(gameItem => {
          const gameAttempt = gameItem.gameAttempts?.find(attempt => attempt.studentId?.toString() === studentId.toString());
          return gameAttempt && gameAttempt.isPassed;
        });

        // Check if previous lesson is completed
        let previousLessonCompleted = false;
        let isFirstLessonInChapter = false;

        if (lesson.orderIndex > 1) {
          // Find the previous lesson by orderIndex WITHIN THE SAME CHAPTER
          const previousLesson = lessons.find(l =>
            l.orderIndex === lesson.orderIndex - 1 &&
            l.chapter === lesson.chapter
          );

          if (previousLesson) {
            const previousLessonId = previousLesson._id.toString();
            const prevProgress = progressMap.get(previousLessonId);
            previousLessonCompleted = prevProgress?.isCompleted === true;
          } else {
            // No previous lesson in same chapter = this is the first lesson of this chapter
            isFirstLessonInChapter = true;
          }
        } else {
          // orderIndex === 1 means this is the very first lesson overall
          isFirstLessonInChapter = true;
        }

        // Check if previous lesson's posttest is passed (required to unlock next lesson)
        let previousLessonPostTestPassed = true; // Default to true for first lesson

        if (lesson.orderIndex > 1 && !isFirstLessonInChapter) {
          // Find previous lesson in same chapter
          const previousLesson = lessons.find(l =>
            l.orderIndex === lesson.orderIndex - 1 &&
            l.chapter === lesson.chapter
          );

          if (previousLesson) {
            const previousLessonId = previousLesson._id.toString();
            const prevProgress = progressMap.get(previousLessonId);
            previousLessonPostTestPassed = prevProgress?.hasPassedPostTest === true;
          } else {
            // No previous lesson found - might be first lesson of chapter
            previousLessonPostTestPassed = true;
          }
        }

        // First lesson overall, OR first lesson of any chapter is always unlocked
        const isUnlockedByOrder = lesson.orderIndex === 1 || isFirstLessonInChapter || previousLessonCompleted;

        // If it's the first lesson of chapter or previous is completed, AND previous posttest is passed, allow access
        if (isUnlockedByOrder && previousLessonPostTestPassed) {
          // For the first lesson of any chapter, skip pre-test requirement and allow direct access
          if (lesson.orderIndex === 1 || isFirstLessonInChapter) {
            if (!lessonCompleted) {
              // First lesson of chapter is always unlocked and accessible
              status = 'UNLOCKED';
              canAccess = true;
            } else if (!postTestCompleted && postTest) {
              // Post-test is ready (must pass to unlock next lesson)
              status = 'POST_TEST_READY';
              canAccess = false;
            } else if (postTestCompleted) {
              // Posttest passed = lesson completed (games are optional)
              status = 'COMPLETED';
              canAccess = false;
            } else if (!postTest && (!gamesWithAttempts.length || gamesCompleted)) {
              // No posttest and games completed/no games
              status = 'COMPLETED';
              canAccess = false;
            } else {
              // Fallback: all completed
              status = 'COMPLETED';
              canAccess = false;
            }
          } else {
            // For subsequent lessons, check if pre-test is required
            if (!lessonCompleted) {
              // Lesson not completed yet - show UNLOCKED status (ready to learn)
              // Even if pretest is not done, lesson is unlocked (pretest is optional to start)
              status = 'UNLOCKED';
              canAccess = true;
            } else if (!postTestCompleted && postTest) {
              // Post-test is ready (must pass to unlock next lesson)
              status = 'POST_TEST_READY';
              canAccess = false;
            } else if (postTestCompleted) {
              // Posttest passed = lesson completed (games are optional)
              status = 'COMPLETED';
              canAccess = false;
            } else if (!postTest && (!gamesWithAttempts.length || gamesCompleted)) {
              // No posttest and games completed/no games
              status = 'COMPLETED';
              canAccess = false;
            } else {
              // Fallback: all completed
              status = 'COMPLETED';
              canAccess = false;
            }
          }
        } else {
          // Locked because:
          // 1. Previous lesson is not completed, OR
          // 2. Previous lesson's posttest is not passed yet
          if (!previousLessonPostTestPassed) {
            // Previous lesson's posttest is not passed yet
            status = 'LOCKED';
            canAccess = false;
          } else {
            // Previous lesson is not completed
            status = 'LOCKED';
            canAccess = false;
          }
        }

        // Return lesson object with status, progress, tests, and games
        return {
          ...lesson.toObject(),
          status,
          canAccess,
          progress: progress ? progress.toObject() : null,
          tests: testsWithAttempts,
          games: gamesWithAttempts,
          preTest,
          postTest
        };
      }));

      return results;
    } catch (error) {
      console.error('getStudentLessons error:', error);
      // Re-throw with more context
      if (error.message && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'))) {
        throw new Error('Database connection timeout. Please try again.');
      }
      throw error;
    }
  }

  static async completeLesson(studentId, lessonId) {
    const lesson = await Lesson.findOne({ _id: lessonId, isDeleted: false });
    if (!lesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    const result = await DatabaseService.createLessonProgress({
      student_id: studentId,
      lesson_id: lessonId,
      is_completed: true,
      completed_at: new Date()
    });

    // Get lesson info for notification (lesson already fetched above)
    if (lesson) {
      // Create notification for lesson completion
      await DatabaseService.createNotification({
        student_id: studentId,
        title: `🎯 เรียนจบบทเรียนแล้ว`,
        message: `คุณเรียนจบ "${lesson.title}" แล้ว ทำแบบทดสอบหลังเรียนเพื่อทดสอบความรู้ของคุณ`,
        event_type: 'LESSON_COMPLETED',
        type: 'SUCCESS'
      });

      // Note: Next lesson will be unlocked only after passing posttest
      // This is handled in getStudentLessons based on hasPassedPostTest
    }

    return result;
  }

  static async getPreTestStatus(studentId, lessonId) {
    // Normalize studentId and lessonId to ObjectId
    let studentObjectId = studentId;
    let lessonObjectId = lessonId;

    // Convert studentId to ObjectId
    if (typeof studentId === 'string' && mongoose.Types.ObjectId.isValid(studentId)) {
      studentObjectId = new mongoose.Types.ObjectId(studentId);
    } else if (studentId && typeof studentId === 'object' && studentId._id) {
      studentObjectId = studentId._id;
    } else if (studentId && typeof studentId === 'object' && studentId.toString) {
      // If it's already an ObjectId, keep it
      studentObjectId = studentId;
    }

    // Convert lessonId to ObjectId
    if (typeof lessonId === 'string' && mongoose.Types.ObjectId.isValid(lessonId)) {
      lessonObjectId = new mongoose.Types.ObjectId(lessonId);
    } else if (lessonId && typeof lessonId === 'object' && lessonId._id) {
      lessonObjectId = lessonId._id;
    } else if (lessonId && typeof lessonId === 'object' && lessonId.toString) {
      lessonObjectId = lessonId;
    }

    // Find pre-test for this lesson
    const preTest = await Test.findOne({
      lessonId: lessonObjectId,
      type: 'PRE_TEST',
      isActive: true,
      isDeleted: false
    });

    if (!preTest) {
      return {
        hasPreTest: false,
        isPreTestCompleted: false, // ยังไม่ทำ ก็คือยังไม่เสร็จ
        canAccessLesson: false    // เข้าเรียนไม่ได้ จนกว่าครูจะสร้างข้อสอบให้ตรง ID
      };
    }

    // Get testId as ObjectId
    const testObjectId = preTest._id;

    // Query TestAttempt with multiple strategies to handle different data types
    // Strategy 1: Try with ObjectId
    let testAttempt = await TestAttempt.findOne({
      studentId: studentObjectId,
      testId: testObjectId
    });

    // Strategy 2: Try with string IDs
    if (!testAttempt) {
      testAttempt = await TestAttempt.findOne({
        studentId: mongoose.Types.ObjectId.isValid(studentId)
          ? new mongoose.Types.ObjectId(studentId)
          : studentId,
        testId: testObjectId
      });
    }

    // Strategy 3: Try with string comparison (MongoDB will handle conversion)
    if (!testAttempt) {
      testAttempt = await TestAttempt.findOne({
        $expr: {
          $and: [
            { $eq: [{ $toString: '$studentId' }, studentId.toString()] },
            { $eq: [{ $toString: '$testId' }, testObjectId.toString()] }
          ]
        }
      });
    }



    const isPreTestCompleted = !!testAttempt;

    return {
      hasPreTest: true,
      isPreTestCompleted: isPreTestCompleted,
      canAccessLesson: isPreTestCompleted, // ต้องทำเสร็จก่อน (true) ถึงจะเข้าเรียนได้
      preTestId: preTest._id.toString(),
      preTestTitle: preTest.title
    };
  }

  static async getPostTestStatus(studentId, lessonId) {
    // Check if lesson is completed
    const lessonProgress = await LessonProgress.findOne({
      studentId,
      lessonId
    });

    const isLessonCompleted = lessonProgress?.isCompleted === true;

    // Find post-test for this lesson
    const postTest = await Test.findOne({
      lessonId,
      type: 'POST_TEST',
      isActive: true,
      isDeleted: false
    });

    if (!postTest) {
      return {
        hasPostTest: false,
        isPostTestUnlocked: isLessonCompleted,
        isPostTestCompleted: false,
        isPostTestPassed: false
      };
    }

    // Check if student has passed post-test (must pass to unlock next lesson)
    const isPostTestPassed = lessonProgress?.hasPassedPostTest === true;

    // Check if student has any attempts (even if not passed)
    const testAttempts = await TestAttempt.find({
      studentId,
      testId: postTest._id
    }).sort({ completedAt: -1 });

    const isPostTestCompleted = testAttempts.length > 0;
    const latestAttempt = testAttempts[0];
    const latestScore = latestAttempt?.score || 0;

    return {
      hasPostTest: true,
      isPostTestUnlocked: isLessonCompleted,
      isPostTestCompleted,
      isPostTestPassed, // Must be true to unlock next lesson
      postTestId: postTest._id.toString(),
      postTestTitle: postTest.title,
      passingScore: postTest.passingScore,
      latestScore: latestScore,
      canRetry: !isPostTestPassed // Can retry if not passed yet
    };
  }

  static async submitActivity(studentId, lessonId, activityId, activityData) {
    // Store activity result in LessonProgress's activityResults field
    // If LessonProgress doesn't have activityResults field, we can store it separately
    // For now, we'll create/update a simple activity result record

    let lessonProgress = await LessonProgress.findOne({
      studentId,
      lessonId
    });

    if (!lessonProgress) {
      // Create new progress record if it doesn't exist
      lessonProgress = await DatabaseService.createLessonProgress({
        student_id: studentId,
        lesson_id: lessonId,
        is_completed: false,
        completed_at: null
      });
    }

    // Store activity results in a simple format
    // In a production system, you might want to create a separate ActivityResult model
    const activityResult = {
      activityId,
      answer: activityData.answer,
      isCorrect: activityData.isCorrect,
      score: activityData.score || (activityData.isCorrect ? 100 : 0),
      timeSpent: activityData.timeSpent || 0,
      submittedAt: new Date()
    };

    // Update or initialize activityResults array
    if (!lessonProgress.activityResults) {
      lessonProgress.activityResults = [];
    }

    // Remove existing result for this activity if exists, then add new one
    lessonProgress.activityResults = lessonProgress.activityResults.filter(
      (r) => r.activityId !== activityId
    );
    lessonProgress.activityResults.push(activityResult);

    // Update time spent
    if (lessonProgress.timeSpent) {
      lessonProgress.timeSpent += activityData.timeSpent || 0;
    } else {
      lessonProgress.timeSpent = activityData.timeSpent || 0;
    }

    await lessonProgress.save();

    return activityResult;
  }

  static async getStudentTests(studentId, classroomId, filters = {}) {
    const query = {
      classroomId,
      isActive: true
    };

    if (filters.lessonId) {
      query.lessonId = filters.lessonId;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    // Add isDeleted filter
    if (!query.isDeleted) {
      query.isDeleted = false;
    }
    // Ensure ObjectId for queries
    const studentObjectId = typeof studentId === 'string' ? new mongoose.Types.ObjectId(studentId) : studentId;
    const classroomObjectId = typeof classroomId === 'string' ? new mongoose.Types.ObjectId(classroomId) : classroomId;

    const tests = await Test.find({ ...query, classroomId: classroomObjectId }).sort({ createdAt: 1 });

    const results = await Promise.all(tests.map(async (testItem) => {
      const questions = await Question.find({ testId: testItem._id }).sort({ orderIndex: 1 });
      const lesson = await Lesson.findOne({ _id: testItem.lessonId, isDeleted: false });
      const attempts = await TestAttempt.find({ testId: testItem._id, studentId: studentObjectId }).sort({ completedAt: -1 });

      return {
        ...testItem.toObject(),
        questions: questions.map(q => {
          const qObj = q.toObject();
          // AUTO-FIX: Patch image URLs in questions
          if (qObj.imageUrl && (qObj.imageUrl.includes('/คำศัพท์บท1-4/') || qObj.imageUrl.includes('/คำศัพท์บท1-3/'))) {
            qObj.imageUrl = qObj.imageUrl.replace(/\/คำศัพท์บท1-[34]\//, '/คำศัพท์บท1-8/');
          }
          return qObj;
        }),
        lesson: lesson?.toObject() || null,
        testAttempts: attempts.map(a => a.toObject()),
        attempted: attempts.length > 0,
        lastAttempt: attempts[0]?.toObject() || null
      };
    }));

    return results;
  }

  static async submitTest(studentId, testId, answers, timeSpent) {
    // Convert studentId and testId to ObjectId if they're strings
    let studentObjectId = studentId;
    let testObjectId = testId;

    if (typeof studentId === 'string' && mongoose.Types.ObjectId.isValid(studentId)) {
      studentObjectId = new mongoose.Types.ObjectId(studentId);
    } else if (studentId && typeof studentId === 'object' && studentId.toString) {
      studentObjectId = studentId;
    }

    if (typeof testId === 'string' && mongoose.Types.ObjectId.isValid(testId)) {
      testObjectId = new mongoose.Types.ObjectId(testId);
    } else if (testId && typeof testId === 'object' && testId.toString) {
      testObjectId = testId;
    }

    // Get test with questions (excluding deleted)
    const test = await Test.findOne({ _id: testObjectId, isDeleted: false });
    const questions = await Question.find({ testId: testObjectId });

    if (!test) {
      throw new Error('ไม่พบแบบทดสอบ');
    }

    // Calculate score
    let correctCount = 0;
    const totalQuestions = questions.length;

    questions.forEach(question => {
      const questionId = question._id.toString();
      const studentAnswer = answers[questionId];
      const correctAnswer = question.correctAnswer;

      let isCorrect = false;

      if (question.isMultipleChoice) {
        // Multiple choice: compare arrays
        if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
          // Sort both arrays and compare as strings
          const studentSorted = [...studentAnswer].sort((a, b) => a - b).join(',');
          const correctSorted = [...correctAnswer].sort((a, b) => a - b).join(',');
          isCorrect = studentSorted === correctSorted;
        } else {
          // If one is not an array, it's wrong
          isCorrect = false;
        }
      } else if (question.isMatching) {
        // Matching: check if all pairs match correctly
        // Student answer can be array of option indices [0, 2] meaning pair 0 → option 0, pair 1 → option 2
        // Or it could be an object {0: 0, 1: 2}
        if (Array.isArray(studentAnswer) && question.matchingPairs && Array.isArray(question.matchingPairs)) {
          // Check if each pair matches correctly
          let allCorrect = true;
          for (let i = 0; i < question.matchingPairs.length; i++) {
            const pair = question.matchingPairs[i];
            const userSelectedOptionIdx = studentAnswer[i];
            const correctOptionIdx = question.options.indexOf(pair.right);

            if (userSelectedOptionIdx !== correctOptionIdx) {
              allCorrect = false;
              break;
            }
          }
          isCorrect = allCorrect && studentAnswer.length === question.matchingPairs.length;
        } else if (typeof studentAnswer === 'object' && studentAnswer !== null && !Array.isArray(studentAnswer)) {
          // Object format: {0: 0, 1: 2}
          const matchingPairs = question.matchingPairs || [];
          let allCorrect = true;

          for (let i = 0; i < matchingPairs.length; i++) {
            const pair = matchingPairs[i];
            const userSelectedOptionIdx = studentAnswer[i];
            const correctOptionIdx = question.options.indexOf(pair.right);

            if (userSelectedOptionIdx !== correctOptionIdx) {
              allCorrect = false;
              break;
            }
          }
          isCorrect = allCorrect && Object.keys(studentAnswer).length === matchingPairs.length;
        } else if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
          // Fallback: compare arrays
          const studentSorted = [...studentAnswer].sort((a, b) => a - b).join(',');
          const correctSorted = [...correctAnswer].sort((a, b) => a - b).join(',');
          isCorrect = studentSorted === correctSorted;
        } else {
          isCorrect = false;
        }
      } else {
        // Single choice: direct comparison
        isCorrect = studentAnswer === correctAnswer;
      }

      if (isCorrect) {
        correctCount++;
      }
    });

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // Pretest: ไม่ต้องผ่านเกณฑ์ (ทำได้เลย) - always pass
    // Posttest: ต้องผ่านเกณฑ์ (ถ้าไม่ผ่านต้องทำซ้ำ)
    let isPassed;
    if (test.type === 'PRE_TEST') {
      // Pretest: ไม่ต้องผ่านเกณฑ์ - ทำได้เลย
      isPassed = true;
    } else {
      // Posttest หรือแบบทดสอบอื่นๆ: ต้องผ่านเกณฑ์
      isPassed = score >= test.passingScore;
    }

    // Get last attempt number - try with ObjectId first, then string
    let lastAttempt = await TestAttempt.findOne({
      studentId: studentObjectId,
      testId: testObjectId
    }).sort({ attemptNumber: -1 });

    if (!lastAttempt) {
      lastAttempt = await TestAttempt.findOne({
        studentId: studentId.toString(),
        testId: testId.toString()
      }).sort({ attemptNumber: -1 });
    }

    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    console.log('submitTest - Creating test attempt:', {
      studentId: studentId?.toString(),
      studentObjectId: studentObjectId?.toString(),
      testId: testId?.toString(),
      testObjectId: testObjectId?.toString(),
      testType: test.type,
      score,
      isPassed,
      attemptNumber,
      passingScore: test.passingScore
    });

    // Create test attempt - use ObjectId for consistency
    const testAttempt = await DatabaseService.createTestAttempt({
      student_id: studentObjectId,
      test_id: testObjectId,
      answers,
      score,
      is_passed: isPassed,
      attempt_number: attemptNumber,
      time_spent: timeSpent,
      completed_at: new Date()
    });

    console.log('submitTest - Test attempt created:', {
      testAttemptId: testAttempt?._id?.toString(),
      testAttemptStudentId: testAttempt?.studentId?.toString(),
      testAttemptStudentIdType: testAttempt?.studentId instanceof mongoose.Types.ObjectId ? 'ObjectId' : typeof testAttempt?.studentId,
      testAttemptTestId: testAttempt?.testId?.toString(),
      testAttemptTestIdType: testAttempt?.testId instanceof mongoose.Types.ObjectId ? 'ObjectId' : typeof testAttempt?.testId,
      score,
      isPassed,
      attemptNumber
    });

    // Verify the test attempt was saved correctly by querying it back
    const verifyAttempt = await TestAttempt.findById(testAttempt._id);
    console.log('submitTest - Verification query:', {
      found: !!verifyAttempt,
      verifyStudentId: verifyAttempt?.studentId?.toString(),
      verifyTestId: verifyAttempt?.testId?.toString()
    });

    // Update lesson progress based on test type
    if (test.lessonId) {
      const lessonProgress = await LessonProgress.findOne({
        studentId: studentObjectId,
        lessonId: test.lessonId
      });

      if (lessonProgress) {
        if (test.type === 'PRE_TEST' && isPassed) {
          lessonProgress.hasPassedPreTest = true;
          await lessonProgress.save();
        } else if (test.type === 'POST_TEST' && isPassed) {
          lessonProgress.hasPassedPostTest = true;
          lessonProgress.isCompleted = true; // Mark as completed on Post-test pass
          lessonProgress.completedAt = new Date();
          await lessonProgress.save();
        }
      } else if (test.type === 'PRE_TEST' && isPassed) {
        // Create lesson progress if it doesn't exist
        await DatabaseService.createLessonProgress({
          student_id: studentObjectId,
          lesson_id: test.lessonId,
          has_passed_pre_test: true
        });
      } else if (test.type === 'POST_TEST' && isPassed) {
        // Create lesson progress if it doesn't exist
        await DatabaseService.createLessonProgress({
          student_id: studentObjectId,
          lesson_id: test.lessonId,
          has_passed_post_test: true,
          is_completed: true,
          completed_at: new Date()
        });
      }
    }

    // Get test info for notification (test already fetched above)
    if (test && isPassed) {
      // Create notification for passing test
      await DatabaseService.createNotification({
        student_id: studentId,
        title: `🎉 ยินดีด้วย คุณผ่านแบบทดสอบแล้ว`,
        message: `คุณทำคะแนนได้ ${score}% ในแบบทดสอบ "${test.title}"`,
        event_type: 'TEST_PASSED',
        type: 'SUCCESS'
      });

      // Calculate stars based on score
      let stars = 0;
      if (score >= 90) stars = 3;
      else if (score >= 80) stars = 2;
      else if (score >= 60) stars = 1;

      if (stars > 0) {
        await Student.findByIdAndUpdate(studentId, { $inc: { coins: stars } });
        
        await DatabaseService.createNotification({
          student_id: studentId,
          title: `⭐ ได้รับ ${stars} ดาว`,
          message: `คุณได้รับ ${stars} ดาวจากแบบทดสอบ "${test.title}"`,
          event_type: 'STAR_AWARDED',
          type: 'SUCCESS'
        });
      }
    } else if (test && test.type === 'POST_TEST' && !isPassed) {
      // Notify student that they need to retry posttest
      await DatabaseService.createNotification({
        student_id: studentId,
        title: `💪 ยังไม่ผ่านแบบทดสอบหลังเรียน`,
        message: `คุณทำคะแนนได้ ${score}% แต่ต้องได้ ${test.passingScore}% ขึ้นไป กรุณาทำใหม่อีกครั้ง`,
        event_type: 'TEST_FAILED',
        type: 'WARNING'
      });
    }

    return {
      ...testAttempt,
      score,
      correctAnswers: correctCount,
      totalQuestions
    };
  }

  static async getStudentGames(studentId, classroomId, filters = {}) {
    const query = {
      classroomId,
      isActive: true
    };

    if (filters.lessonId) {
      query.lessonId = filters.lessonId;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    // Add isDeleted filter
    if (!query.isDeleted) {
      query.isDeleted = false;
    }
    // Ensure ObjectId for queries
    const studentObjectId = typeof studentId === 'string' ? new mongoose.Types.ObjectId(studentId) : studentId;
    const classroomObjectId = typeof classroomId === 'string' ? new mongoose.Types.ObjectId(classroomId) : classroomId;

    const games = await Game.find({ ...query, classroomId: classroomObjectId });

    const results = await Promise.all(games.map(async (gameItem) => {
      const lesson = await Lesson.findOne({ _id: gameItem.lessonId, isDeleted: false });
      const attempts = await GameAttempt.find({ gameId: gameItem._id, studentId: studentObjectId }).sort({ completedAt: -1 });

      return {
        ...gameItem.toObject(),
        lesson: lesson?.toObject() || null,
        gameAttempts: attempts.map(a => a.toObject()),
        attempted: attempts.length > 0,
        lastAttempt: attempts[0]?.toObject() || null
      };
    }));

    return results;
  }

  static async submitGame(studentId, gameId, gameData) {
    // Get game (excluding deleted)
    const game = await Game.findOne({ _id: gameId, isDeleted: false });

    if (!game) {
      throw new Error('ไม่พบเกม');
    }

    // Get last attempt number
    const lastAttempt = await GameAttempt.findOne({ studentId, gameId })
      .sort({ attemptNumber: -1 });

    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    // Determine if passed (you can customize this logic)
    const isPassed = gameData.score >= 60; // Default passing score

    // Create game attempt
    const gameAttempt = await DatabaseService.createGameAttempt({
      student_id: studentId,
      game_id: gameId,
      score: gameData.score,
      level: gameData.level || 1,
      is_passed: isPassed,
      attempt_number: attemptNumber,
      time_spent: gameData.timeSpent,
      data: gameData.data,
      completed_at: new Date()
    });

    // Get game info for notification (game already fetched above)
    if (game) {
      // Update student medals (stars)
      let earnedStars = 0;
      if (gameData.score >= 90) earnedStars = 3;
      else if (gameData.score >= 80) earnedStars = 2;
      else if (gameData.score >= 60) earnedStars = 1;

      if (earnedStars > 0) {
        await Student.findByIdAndUpdate(studentId, { $inc: { stars: earnedStars } });
      }

      // Create notification for 100% score (gold medal)
      if (gameData.score === 100) {
        await DatabaseService.createNotification({
          student_id: studentId,
          title: `🥇 ได้เหรียญทอง`,
          message: `คุณเล่นเกม "${game.title}" ได้คะแนน 100% (+3 เหรียญ)`,
          event_type: 'GAME_GOLD_MEDAL',
          type: 'SUCCESS'
        });
      } else if (isPassed) {
        // Create notification for completing game
        await DatabaseService.createNotification({
          student_id: studentId,
          title: `🎮 ผ่านเกมแล้ว`,
          message: `คุณเล่นเกม "${game.title}" ได้คะแนน ${gameData.score}% ${earnedStars > 0 ? `(+${earnedStars} เหรียญ)` : ''}`,
          event_type: 'GAME_PASSED',
          type: 'SUCCESS'
        });
      }
    }

    return {
      ...gameAttempt,
      score: gameData.score,
      isPassed: isPassed
    };
  }

  static async getStudentProgress(studentId) {
    const progress = await LessonProgress.find({ studentId });

    const progressWithLesson = await Promise.all(progress.map(async (p) => {
      const lesson = await Lesson.findOne({ _id: p.lessonId, isDeleted: false });
      const classroom = lesson ? await (await import('../models/Classroom.js')).Classroom.findById(lesson.classroomId) : null;

      return {
        ...p.toObject(),
        lesson: lesson ? {
          ...lesson.toObject(),
          classroom: classroom?.toObject() || null
        } : null
      };
    }));

    const testAttempts = await TestAttempt.find({ studentId }).sort({ completedAt: -1 });

    const testAttemptsWithTest = await Promise.all(testAttempts.map(async (attempt) => {
      const test = await Test.findOne({ _id: attempt.testId, isDeleted: false });
      const lesson = test ? await Lesson.findOne({ _id: test.lessonId, isDeleted: false }) : null;

      return {
        ...attempt.toObject(),
        test: test ? {
          ...test.toObject(),
          lesson: lesson?.toObject() || null
        } : null
      };
    }));

    const gameAttempts = await GameAttempt.find({ studentId }).sort({ completedAt: -1 });

    const gameAttemptsWithGame = await Promise.all(gameAttempts.map(async (attempt) => {
      const game = await Game.findOne({ _id: attempt.gameId, isDeleted: false });
      const lesson = game ? await Lesson.findOne({ _id: game.lessonId, isDeleted: false }) : null;

      return {
        ...attempt.toObject(),
        game: game ? {
          ...game.toObject(),
          lesson: lesson?.toObject() || null
        } : null
      };
    }));

    return {
      lessons: progressWithLesson,
      tests: testAttemptsWithTest,
      games: gameAttemptsWithGame
    };
  }

  static async getStudentNotifications(studentId, unreadOnly = false) {
    return await DatabaseService.getNotificationsByStudent(studentId, unreadOnly);
  }

  static async markNotificationAsRead(studentId, notificationId) {
    return await DatabaseService.markNotificationAsRead(studentId, notificationId);
  }

  static async markAllNotificationsAsRead(studentId) {
    return await DatabaseService.markAllNotificationsAsRead(studentId);
  }

  static async detectHandwritingAI(imageData, targetWord) {
    try {
      // Validate imageData exists
      if (!imageData || typeof imageData !== 'string') {
        throw new Error('Invalid image data');
      }

      // Check if imageData is a valid base64 string with content
      if (!imageData.startsWith('data:image/')) {
        throw new Error('Invalid image format');
      }

      // Extract the base64 portion
      const base64Data = imageData.split(',')[1];
      if (!base64Data || base64Data.length < 100) {
        throw new Error('Canvas appears to be empty');
      }

      // Use Google Gemini API only
      const { GeminiService } = await import('./geminiService.js');
      console.log('🤖 Using Google Gemini API for handwriting detection...');

      if (!GeminiService.isConfigured()) {
        throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in .env file');
      }

      const geminiResult = await GeminiService.detectHandwriting(imageData, targetWord);

      // Apply strict validation
      const detectedText = geminiResult.detectedText || '';
      let isCorrect = geminiResult.isCorrect || false;
      let confidence = Math.min(100, Math.max(0, geminiResult.confidence || 0));

      // STRICT VALIDATION: Additional checks to ensure accuracy
      const detectedLower = detectedText.toLowerCase().trim();
      const targetLower = targetWord.toLowerCase().trim();
      const isCharacterMatch = detectedLower === targetLower;
      const isRandomPattern = /(random|scribble|circle|line|doodle|shape)/i.test(detectedText) ||
        detectedText.length > targetWord.length + 3;
      const meetsConfidenceThreshold = confidence >= 80;

      if (isRandomPattern) {
        console.warn(`Rejecting random pattern: "${detectedText}"`);
        isCorrect = false;
        confidence = Math.min(confidence, 30);
      }

      if (isCorrect) {
        if (!isCharacterMatch) {
          console.warn(`⚠️ Character mismatch: detected "${detectedText}" vs target "${targetWord}" - REJECTING`);
          isCorrect = false;
          confidence = Math.min(confidence, 40);
        }

        if (!meetsConfidenceThreshold || confidence < 80) {
          console.warn(`⚠️ Confidence ${confidence}% is below 80% threshold - REJECTING (likely poor tracing)`);
          isCorrect = false;
          confidence = Math.min(confidence, 50);
        }

        const explanationLower = (geminiResult.explanation || '').toLowerCase();
        const tracingIssues = [
          'messy', 'scribble', 'scribbles', 'ไม่ทับ', 'นอกกรอบ', 'เขียนนอก', 'เขียนมั่ว',
          'ไม่ตาม', 'ไม่ตรง', 'ห่าง', 'gap', 'random', 'messed', 'zig', 'zag',
          'หลายเส้น', 'ทับกัน', 'ระบาย', 'coloring', 'thick', 'หนาเกิน'
        ];
        const hasTracingIssue = tracingIssues.some(keyword => explanationLower.includes(keyword));

        if (hasTracingIssue) {
          console.warn(`⚠️ Explanation mentions tracing issues - REJECTING (messy scribbles detected)`);
          isCorrect = false;
          confidence = Math.min(confidence, 30);
        }

        const goodTracingKeywords = ['ทับเส้นประ', 'ตามเส้น', 'ชัดเจน', 'เส้นเดียว', 'ดีมาก', 'ถูกต้อง'];
        const hasGoodTracing = goodTracingKeywords.some(keyword => explanationLower.includes(keyword));

        if (!hasGoodTracing && confidence < 90) {
          console.warn(`⚠️ No good tracing keywords in explanation with confidence ${confidence}% - REJECTING (likely messy)`);
          isCorrect = false;
          confidence = Math.min(confidence, 40);
        }
      }

      if (confidence < 40) {
        isCorrect = false;
      }

      let explanation = geminiResult.explanation || '';
      if (!isCorrect) {
        if (!isCharacterMatch && !isRandomPattern) {
          explanation = `เขียนได้ "${detectedText}" แต่ควรเขียน "${targetWord}" ลองเขียนให้ตรงกับอักษรที่กำหนด`;
        } else if (isRandomPattern || confidence < 50) {
          explanation = 'ลองเขียนตามเส้นประให้ชัดเจนขึ้นนะ';
        } else if (!meetsConfidenceThreshold) {
          explanation = 'ลองเขียนให้ใกล้เส้นประมากขึ้น พยายามอีกนิดนะ';
        } else {
          explanation = explanation || 'กรุณาเขียนตามเส้นประให้ถูกต้อง';
        }
      }

      console.log('Final validation result:', {
        detectedText,
        targetWord,
        isCharacterMatch,
        isRandomPattern: isRandomPattern || false,
        meetsConfidenceThreshold,
        finalIsCorrect: isCorrect,
        finalConfidence: confidence
      });

      return {
        detectedText,
        isCorrect,
        confidence,
        explanation,
        method: 'Gemini'
      };

    } catch (error) {
      console.error('Handwriting detection AI error:', error);
      const errorMessage = error.message.toLowerCase();

      // Handle temporary high demand / overloaded errors
      if (errorMessage.includes('high demand') || errorMessage.includes('503') || 
          errorMessage.includes('overloaded') || errorMessage.includes('temporarily unavailable')) {
        throw new Error('AI กำลังทำงานหนัก (High Demand) กรุณารอ 5-10 วินาทีแล้วลองกด "ตรวจคำตอบ" ใหม่อีกครั้งนะครับ');
      }

      // Check for other specific errors
      if (error.message?.includes('leaked') || error.message?.includes('reported')) {
        throw new Error('API key was reported as leaked. Please contact admin.');
      } else if (error.message?.includes('API key') || error.message?.includes('401') || error.message?.includes('403')) {
        throw new Error('Gemini API authentication failed.');
      } else if (error.message?.includes('QUOTA_EXCEEDED') || error.message?.includes('quota') ||
        error.message?.includes('429') || error.message?.includes('rate limit')) {
        throw new Error('โควตาการใช้งาน AI เต็มชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลัง');
      }

      throw error;
    }
  }
}