import { DatabaseService } from './databaseService.js';
import { Lesson } from '../models/Lesson.js';
import { Test } from '../models/Test.js';
import { Question } from '../models/Question.js';
import { Game } from '../models/Game.js';
import { generateRandomMatchingQuestion } from '../helpers/questionGenerator.js';

export class LessonService {
  static async createLesson(lessonData) {
    return await DatabaseService.createLesson({
      title: lessonData.title,
      content: lessonData.content,
      audio_url: lessonData.audioUrl,
      image_url: lessonData.imageUrl,
      order_index: lessonData.orderIndex,
      classroom_id: lessonData.classroomId,
      teacher_id: lessonData.teacherId,
      is_active: true
    });
  }

  static async getLessonsByClassroom(classroomId, teacherId) {
    const lessons = await DatabaseService.getLessonsByClassroom(classroomId);

    // AUTO-FIX: Update old path `/คำศัพท์บท1-4/` or `/คำศัพท์บท1-3/` to `/คำศัพท์บท1-8/`
    const oldPaths = ['/คำศัพท์บท1-4/', '/คำศัพท์บท1-3/'];

    for (const lesson of lessons) {
      if (lesson.content) {
        let hasChanges = false;
        let updatedContent = lesson.content;

        for (const oldPath of oldPaths) {
          if (updatedContent.includes(oldPath)) {
            console.log(`Auto-updating lesson ${lesson.orderIndex} from ${oldPath} to /คำศัพท์บท1-8/`);
            updatedContent = updatedContent.replaceAll(oldPath, '/คำศัพท์บท1-8/');
            hasChanges = true;
          }
        }

        if (hasChanges) {
          lesson.content = updatedContent;
          try {
            await Lesson.updateOne({ _id: lesson._id || lesson.id }, { content: updatedContent });
          } catch (e) {
            console.error('Failed to update lesson path:', e);
          }
        }
      }
    }

    // AUTO-FIX: Patch Lesson 1 Kor Kon if needed (Fixes 404 for ฅ)
    for (const lesson of lessons) {
      // Check if it's Lesson 1 (orderIndex 1) and has the old broken content
      if (lesson.orderIndex === 1 && lesson.content && lesson.content.includes('"vocabImage": null, "label": "ฅ คน"')) {
        console.log('Auto-patching Lesson 1 content (Kor Kon image)...');
        const newContent = lesson.content.replace(
          '"vocabImage": null, "label": "ฅ คน"',
          '"vocabImage": "/คำศัพท์บท1-8/บทที่1/คน.png", "label": "ฅ คน"'
        );

        // Update in memory for immediate response
        lesson.content = newContent;

        // Update in Database so it persists
        try {
          await Lesson.updateOne({ _id: lesson._id || lesson.id }, { content: newContent });
        } catch (e) { console.error('Patch failed', e); }
      }

      // Patch Lesson 2: Add missing vocabulary (จาน, ฉิ่ง, ช้าง, ซอ)
      if (lesson.orderIndex === 2 && lesson.content && !lesson.content.includes('"word": "จาน"')) {
        console.log('Auto-patching Lesson 2 content (Adding vocabulary)...');
        const newContent2 = `[MEDIA]
{"items": [
  {"word": "จ", "image": "/ก-ฮ/จ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่2/จาน.png", "label": "จ จาน"},
  {"word": "ฉ", "image": "/ก-ฮ/ฉ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่2/ฉิ่ง.png", "label": "ฉ ฉิ่ง"},
  {"word": "ช", "image": "/ก-ฮ/ช.png", "vocabImage": "/คำศัพท์บท1-8/บทที่2/ช้าง.png", "label": "ช ช้าง"},
  {"word": "ซ", "image": "/ก-ฮ/ซ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่2/ซอ.png", "label": "ซ โซ่"},
  {"word": "ฌ", "image": "/ก-ฮ/ฌ.png", "vocabImage": null, "label": "ฌ เฌอ"},
  {"word": "ญ", "image": "/ก-ฮ/ญ.png", "vocabImage": null, "label": "ญ หญิง"},
  {"word": "ฎ", "image": "/ก-ฮ/ฎ.png", "vocabImage": null, "label": "ฎ ชฎา"},
  {"word": "ฏ", "image": "/ก-ฮ/ฏ.png", "vocabImage": null, "label": "ฏ ปฏัก"},
  {"word": "ฐ", "image": "/ก-ฮ/ฐ.png", "vocabImage": null, "label": "ฐ ฐาน"},
  {"word": "ฑ", "image": "/ก-ฮ/ฑ.png", "vocabImage": null, "label": "ฑ มณโฑ"},
  {"word": "ฒ", "image": "/ก-ฮ/ฒ.png", "vocabImage": null, "label": "ฒ ผู้เฒ่า"},
  {"word": "ณ", "image": "/ก-ฮ/ณ.png", "vocabImage": null, "label": "ณ เณร"},
  {"word": "จาน", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่2/จาน.png", "label": "จาน"},
  {"word": "ฉิ่ง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่2/ฉิ่ง.png", "label": "ฉิ่ง"},
  {"word": "ช้าง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่2/ช้าง.png", "label": "ช้าง"},
  {"word": "ซอ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่2/ซอ.png", "label": "ซอ"}
]}
[/MEDIA]`;
        lesson.content = newContent2;
        try { await Lesson.updateOne({ _id: lesson._id || lesson.id }, { content: newContent2 }); } catch (e) { console.error('Patch failed', e); }
      }

      // Patch Lesson 3: Add missing vocabulary (เด็ก, เต่า, ถุง, ทหาร, ธง, หนู, ใบไม้, ปลา, ผึ้ง, ม้า)
      if (lesson.orderIndex === 3 && lesson.content && !lesson.content.includes('"word": "เด็ก"')) {
        console.log('Auto-patching Lesson 3 content (Adding vocabulary)...');
        const newContent3 = `[MEDIA]
{"items": [
  {"word": "ด", "image": "/ก-ฮ/ด.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/เด็ก.png", "label": "ด เด็ก"},
  {"word": "ต", "image": "/ก-ฮ/ต.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/เต่า.png", "label": "ต เต่า"},
  {"word": "ถ", "image": "/ก-ฮ/ถ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ถุง.png", "label": "ถ ถุง"},
  {"word": "ท", "image": "/ก-ฮ/ท.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ทหาร.png", "label": "ท ทหาร"},
  {"word": "ธ", "image": "/ก-ฮ/ธ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ธง.png", "label": "ธ ธง"},
  {"word": "น", "image": "/ก-ฮ/น.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/หนู.png", "label": "น หนู"},
  {"word": "บ", "image": "/ก-ฮ/บ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ใบไม้.png", "label": "บ ใบไม้"},
  {"word": "ป", "image": "/ก-ฮ/ป.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ปลา.png", "label": "ป ปลา"},
  {"word": "ผ", "image": "/ก-ฮ/ผ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ผึ้ง.png", "label": "ผ ผึ้ง"},
  {"word": "ฝ", "image": "/ก-ฮ/ฝ.png", "vocabImage": null, "label": "ฝ ฝา"},
  {"word": "พ", "image": "/ก-ฮ/พ.png", "vocabImage": null, "label": "พ พาน"},
  {"word": "ฟ", "image": "/ก-ฮ/ฟ.png", "vocabImage": null, "label": "ฟ ฟัน"},
  {"word": "ภ", "image": "/ก-ฮ/ภ.png", "vocabImage": null, "label": "ภ สำเภา"},
  {"word": "ม", "image": "/ก-ฮ/ม.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ม้า.png", "label": "ม ม้า"},
  {"word": "เด็ก", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/เด็ก.png", "label": "เด็ก"},
  {"word": "เต่า", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/เต่า.png", "label": "เต่า"},
  {"word": "ถุง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ถุง.png", "label": "ถุง"},
  {"word": "ทหาร", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ทหาร.png", "label": "ทหาร"},
  {"word": "ธง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ธง.png", "label": "ธง"},
  {"word": "หนู", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/หนู.png", "label": "หนู"},
  {"word": "ใบไม้", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ใบไม้.png", "label": "ใบไม้"},
  {"word": "ปลา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ปลา.png", "label": "ปลา"},
  {"word": "ผึ้ง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ผึ้ง.png", "label": "ผึ้ง"},
  {"word": "ม้า", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ม้า.png", "label": "ม้า"}
]}
[/MEDIA]`;
        lesson.content = newContent3;
        try { await Lesson.updateOne({ _id: lesson._id || lesson.id }, { content: newContent3 }); } catch (e) { console.error('Patch failed', e); }
      }
    }

    // AUTO-CREATE: Lesson 4 (Missing in existing classes)
    // Only run if teacherId is provided (e.g. called from Teacher Dashboard)
    const hasLesson4 = lessons.some(l => l.orderIndex === 4);
    if (!hasLesson4 && teacherId && lessons.length > 0) {
      console.log('Auto-creating Lesson 4 for existing classroom...');
      const lesson4Content = `[MEDIA]
{"items": [
  {"word": "ย", "image": "/ก-ฮ/ย.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/ยักษ์.png", "label": "ย ยักษ์"},
  {"word": "ร", "image": "/ก-ฮ/ร.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/เรือ.png", "label": "ร เรือ"},
  {"word": "ล", "image": "/ก-ฮ/ล.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/ลิง.png", "label": "ล ลิง"},
  {"word": "ว", "image": "/ก-ฮ/ว.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/แหวน.png", "label": "ว แหวน"},
  {"word": "ศ", "image": "/ก-ฮ/ศ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/ศาลา.png", "label": "ศ ศาลา"},
  {"word": "ษ", "image": "/ก-ฮ/ษ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/ฤาษี.png", "label": "ษ ฤาษี"},
  {"word": "ส", "image": "/ก-ฮ/ส.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/เสือ.png", "label": "ส เสือ"},
  {"word": "ห", "image": "/ก-ฮ/ห.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/หีบ.png", "label": "ห หีบ"},
  {"word": "ฬ", "image": "/ก-ฮ/ฬ.png", "vocabImage": null, "label": "ฬ จุฬา"},
  {"word": "อ", "image": "/ก-ฮ/อ.png", "vocabImage": null, "label": "อ อ่าง"},
  {"word": "ฮ", "image": "/ก-ฮ/ฮ.png", "vocabImage": null, "label": "ฮ นกฮูก"},
  {"word": "ยักษ์", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/ยักษ์.png", "label": "ยักษ์"},
  {"word": "เรือ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/เรือ.png", "label": "เรือ"},
  {"word": "ฤาษี", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/ฤาษี.png", "label": "ฤาษี"},
  {"word": "ลิง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/ลิง.png", "label": "ลิง"},
  {"word": "ศาลา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/ศาลา.png", "label": "ศาลา"},
  {"word": "เสือ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/เสือ.png", "label": "เสือ"},
  {"word": "หีบ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/หีบ.png", "label": "หีบ"},
  {"word": "แหวน", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/แหวน.png", "label": "แหวน"}
]}
[/MEDIA]`;

      try {
        const newLesson = await this.createLesson({
          title: '🦁 บทที่ 4: พยัญชนะ ย–ฮ',
          content: lesson4Content,
          category: 'consonants',
          chapter: '1',
          orderIndex: 4,
          classroomId,
          teacherId
        });

        // Generate Tests/Games
        await this.generateDefaultTests(newLesson._id, teacherId);
        await this.generateDefaultGames(newLesson._id, teacherId);

        lessons.push(newLesson);
        console.log('Successfully injected Lesson 4');
      } catch (error) {
        console.error('Failed to inject Lesson 4:', error);
      }
    }

    // Format with tests and games
    return lessons.map(lesson => ({
      ...lesson,
      tests: lesson.tests || [],
      games: lesson.games || []
    }));
  }

  static async getLessonById(lessonId) {
    const lesson = await DatabaseService.getLessonById(lessonId);

    // AUTO-FIX: Update old path `/คำศัพท์บท1-4/` or `/คำศัพท์บท1-3/` to `/คำศัพท์บท1-8/`
    if (lesson?.content) {
      const oldPaths = ['/คำศัพท์บท1-4/', '/คำศัพท์บท1-3/'];
      let hasChanges = false;
      let updatedContent = lesson.content;

      for (const oldPath of oldPaths) {
        if (updatedContent.includes(oldPath)) {
          console.log(`Auto-updating lesson ${lesson.orderIndex} from ${oldPath} to /คำศัพท์บท1-8/`);
          updatedContent = updatedContent.replaceAll(oldPath, '/คำศัพท์บท1-8/');
          hasChanges = true;
        }
      }

      if (hasChanges) {
        lesson.content = updatedContent;
        try {
          await Lesson.updateOne({ _id: lesson._id || lesson.id }, { content: updatedContent });
        } catch (e) {
          console.error('Failed to update lesson path:', e);
        }
      }
    }

    return lesson;
  }

  static async updateLesson(lessonId, teacherId, updateData) {
    // Check if lesson exists and belongs to teacher (excluding deleted)
    const existingLesson = await Lesson.findOne({
      _id: lessonId,
      teacherId,
      isDeleted: false
    });

    if (!existingLesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    // Update lesson
    return await DatabaseService.updateLesson(lessonId, {
      title: updateData.title,
      content: updateData.content,
      audio_url: updateData.audioUrl,
      image_url: updateData.imageUrl,
      order_index: updateData.orderIndex,
      is_active: updateData.isActive
    });
  }

  static async deleteLesson(lessonId, teacherId) {
    // Check if lesson exists and belongs to teacher (including deleted ones for restore check)
    const existingLesson = await Lesson.findOne({
      _id: lessonId,
      teacherId
    });

    if (!existingLesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    if (existingLesson.isDeleted) {
      throw new Error('บทเรียนนี้ถูกลบไปแล้ว');
    }

    // Soft delete
    return await DatabaseService.deleteLesson(lessonId);
  }

  static async restoreLesson(lessonId, teacherId) {
    // Check if lesson exists and belongs to teacher (including deleted ones)
    const existingLesson = await Lesson.findOne({
      _id: lessonId,
      teacherId
    });

    if (!existingLesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    if (!existingLesson.isDeleted) {
      throw new Error('บทเรียนนี้ยังไม่ได้ถูกลบ');
    }

    // Restore lesson
    return await DatabaseService.restoreLesson(lessonId);
  }

  static async createTest(lessonId, teacherId, testData) {
    // Check if lesson exists and belongs to teacher (excluding deleted)
    const lesson = await Lesson.findOne({
      _id: lessonId,
      teacherId,
      isDeleted: false
    });

    if (!lesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    // Create test
    return await DatabaseService.createTest({
      title: testData.title,
      type: testData.type,
      time_limit: testData.timeLimit,
      lesson_id: lessonId,
      classroom_id: lesson.classroomId,
      teacher_id: teacherId,
      passing_score: testData.passingScore || 60,
      is_active: true
    });
  }

  static async createQuestion(testId, teacherId, questionData) {
    // Check if test exists and belongs to teacher
    const test = await Test.findOne({
      _id: testId,
      teacherId
    });

    if (!test) {
      throw new Error('ไม่พบแบบทดสอบ');
    }

    // Get the last question order
    const lastQuestion = await Question.findOne({ testId })
      .sort({ orderIndex: -1 });

    const orderIndex = lastQuestion ? lastQuestion.orderIndex + 1 : 1;

    // Create question
    return await DatabaseService.createQuestion({
      test_id: testId,
      question: questionData.question,
      options: questionData.options,
      correct_answer: questionData.correctAnswer,
      explanation: questionData.explanation,
      image_url: questionData.imageUrl,
      audio_url: questionData.audioUrl,
      is_multiple_choice: questionData.isMultipleChoice || false,
      is_matching: questionData.isMatching || false,
      matching_pairs: questionData.matchingPairs,
      image_options: questionData.imageOptions,
      order_index: orderIndex
    });
  }

  static async createGame(lessonId, teacherId, gameData) {
    // Check if lesson exists and belongs to teacher (excluding deleted)
    const lesson = await Lesson.findOne({
      _id: lessonId,
      teacherId,
      isDeleted: false
    });

    if (!lesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    // Create game
    return await DatabaseService.createGame({
      title: gameData.title,
      type: gameData.type,
      settings: gameData.settings,
      lesson_id: lessonId,
      classroom_id: lesson.classroomId,
      teacher_id: teacherId,
      is_active: true
    });
  }

  static async deleteTest(testId, teacherId) {
    // Check if test exists and belongs to teacher
    const test = await Test.findOne({
      _id: testId,
      teacherId
    });

    if (!test) {
      throw new Error('ไม่พบแบบทดสอบ');
    }

    if (test.isDeleted) {
      throw new Error('แบบทดสอบนี้ถูกลบไปแล้ว');
    }

    return await DatabaseService.deleteTest(testId);
  }

  static async updateTest(testId, teacherId, updateData) {
    const test = await Test.findOne({ _id: testId, teacherId, isDeleted: false });
    if (!test) throw new Error('ไม่พบแบบทดสอบ');
    return await DatabaseService.updateTest(testId, {
      title: updateData.title,
      timeLimit: updateData.timeLimit,
      passingScore: updateData.passingScore,
      isActive: updateData.isActive
    });
  }

  static async restoreTest(testId, teacherId) {
    // Check if test exists and belongs to teacher (including deleted ones)
    const test = await Test.findOne({
      _id: testId,
      teacherId
    });

    if (!test) {
      throw new Error('ไม่พบแบบทดสอบ');
    }

    if (!test.isDeleted) {
      throw new Error('แบบทดสอบนี้ยังไม่ได้ถูกลบ');
    }

    return await DatabaseService.restoreTest(testId);
  }

  static async deleteGame(gameId, teacherId) {
    // Check if game exists and belongs to teacher (excluding deleted)
    const game = await Game.findOne({
      _id: gameId,
      teacherId,
      isDeleted: false
    });

    if (!game) {
      throw new Error('ไม่พบเกม');
    }

    if (game.isDeleted) {
      throw new Error('เกมนี้ถูกลบไปแล้ว');
    }

    return await DatabaseService.deleteGame(gameId);
  }

  static async updateGame(gameId, teacherId, updateData) {
    const game = await Game.findOne({ _id: gameId, teacherId, isDeleted: false });
    if (!game) throw new Error('ไม่พบเกม');
    return await DatabaseService.updateGame(gameId, {
      title: updateData.title,
      settings: updateData.settings,
      isActive: updateData.isActive
    });
  }

  static async restoreGame(gameId, teacherId) {
    // Check if game exists and belongs to teacher (including deleted ones)
    const game = await Game.findOne({
      _id: gameId,
      teacherId
    });

    if (!game) {
      throw new Error('ไม่พบเกม');
    }

    if (!game.isDeleted) {
      throw new Error('เกมนี้ยังไม่ได้ถูกลบ');
    }

    return await DatabaseService.restoreGame(gameId);
  }

  static async generateDefaultTests(lessonId, teacherId) {
    // Check if tests already exist for this lesson
    const existingTests = await Test.find({ lessonId, teacherId });
    if (existingTests.length > 0) {
      // Return existing tests instead of creating duplicates
      return existingTests.map(t => t.toObject());
    }

    // Get lesson details
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    // Generate questions based on lesson content
    const getQuestionsForLesson = (lesson) => {
      const lessonTitle = lesson.title || '';
      const lessonContent = lesson.content || '';
      const orderIndex = lesson.orderIndex || 0;

      // Extract key information from lesson
      let questions = [];

      // Note: generateRandomMatchingQuestion is now imported from helpers/questionGenerator.js

      // บทที่ 1: พยัญชนะ ก–ง
      if (orderIndex === 1 || lessonTitle.includes('พยัญชนะ ก–ง')) {
        // All available pairs for this lesson - only use words that have actual images
        const allPairs = [
          { left: 'ก', leftImage: '/แบบทดสอบ/บทที่1/ก.png', right: 'ไก่', rightImage: '/แบบทดสอบ/บทที่1/ไก่.png' },
          { left: 'ง', leftImage: '/แบบทดสอบ/บทที่1/ง.png', right: 'งู', rightImage: '/แบบทดสอบ/บทที่1/งู.png' }
        ];
        const allConsonants = ['ก', 'ง'];
        const allWords = ['ไก่', 'งู'];

        questions = {
          preTest: [
            {
              question: 'ดูภาพ แล้วเลือกพยัญชนะต้นของภาพนี้ (เลือกตอบ 1 ข้อ)',
              options: ['ก', 'จ', 'ง', 'ด'],
              correctAnswer: 0,
              explanation: 'ภาพนี้คือ "ไก่" ขึ้นต้นด้วยพยัญชนะ "ก"',
              imageUrl: '/แบบทดสอบ/บทที่1/รูปไก่.png'
            },
            {
              question: 'เลือกพยัญชนะที่อยู่ในกลุ่ม ก ถึง ง (เลือกหลายคำตอบ)',
              options: ['ก', 'ณ', 'ต', 'ง'],
              correctAnswer: [0, 3], // Multiple choice: ก และ ง
              explanation: 'พยัญชนะในกลุ่ม ก ถึง ง คือ ก, ข, ค, ฆ, ง',
              isMultipleChoice: true,
              imageOptions: [
                '/แบบทดสอบ/บทที่1/ก.png',
                '/แบบทดสอบ/บทที่1/ณ.png',
                '/แบบทดสอบ/บทที่1/ต.png',
                '/แบบทดสอบ/บทที่1/ง.png'
              ]
            },
            generateRandomMatchingQuestion(allPairs, allConsonants, allWords, 1)
          ],
          postTest: [] // จะใช้ preTest แทน
        };
      }
      // บทที่ 2: พยัญชนะ จ–ณ
      else if (orderIndex === 2 || lessonTitle.includes('พยัญชนะ จ–ณ')) {
        // All available pairs for this lesson - only use words that have actual images
        // Note: จ doesn't have leftImage, so we use only ช-ช้าง for matching
        // But we need at least 2 pairs, so we'll use จ-จาน with fallback leftImage
        const allPairs = [
          { left: 'จ', leftImage: '/แบบทดสอบ/บทที่2/จาน.png', right: 'จาน', rightImage: '/แบบทดสอบ/บทที่2/จาน.png' },
          { left: 'ช', leftImage: '/แบบทดสอบ/บทที่2/ช.png', right: 'ช้าง', rightImage: '/แบบทดสอบ/บทที่2/ช้าง.png' }
        ];
        const allConsonants = ['จ', 'ช'];
        const allWords = ['จาน', 'ช้าง'];

        questions = {
          preTest: [
            {
              question: 'ดูภาพ แล้วเลือกพยัญชนะต้นของภาพนี้ (เลือกตอบ 1 ข้อ)',
              options: ['ก', 'จ', 'ง', 'ด'],
              correctAnswer: 1,
              explanation: 'ภาพนี้คือ "จาน" ขึ้นต้นด้วยพยัญชนะ "จ"',
              imageUrl: '/แบบทดสอบ/บทที่2/รูปจาน.png'
            },
            {
              question: 'เลือกพยัญชนะที่อยู่ในกลุ่ม จ ถึง ณ (เลือกหลายคำตอบ)',
              options: ['ณ', 'ด', 'ช', 'ญ'],
              correctAnswer: [0, 2], // Multiple choice: ณ และ ช
              explanation: 'พยัญชนะในกลุ่ม จ ถึง ณ คือ จ, ฉ, ช, ซ, ฌ, ญ, ฎ, ฏ, ฐ, ฑ, ฒ, ณ',
              isMultipleChoice: true,
              imageOptions: [
                '/แบบทดสอบ/บทที่2/ณ.png',
                '/แบบทดสอบ/บทที่2/ด.png',
                '/แบบทดสอบ/บทที่2/ช.png',
                '/แบบทดสอบ/บทที่2/ญ.png'
              ]
            },
            generateRandomMatchingQuestion(allPairs, allConsonants, allWords, 2)
          ],
          postTest: [] // จะใช้ preTest แทน
        };
      }
      // บทที่ 3: พยัญชนะ ด–ม
      else if (orderIndex === 3 || lessonTitle.includes('พยัญชนะ ด–ม')) {
        // All available pairs for this lesson - only use words that have actual images
        // Note: ต and ม don't have leftImage, so we use fallback images
        const allPairs = [
          { left: 'ต', leftImage: '/แบบทดสอบ/บทที่3/เต่า.png', right: 'เต่า', rightImage: '/แบบทดสอบ/บทที่3/เต่า.png' },
          { left: 'ม', leftImage: '/แบบทดสอบ/บทที่3/ม้า.png', right: 'ม้า', rightImage: '/แบบทดสอบ/บทที่3/ม้า.png' },
          { left: 'ป', leftImage: '/แบบทดสอบ/บทที่3/ป.png', right: 'ปลา', rightImage: '/แบบทดสอบ/บทที่3/ปลา.png' }
        ];
        const allConsonants = ['ต', 'ม', 'ป'];
        const allWords = ['เต่า', 'ม้า', 'ปลา'];

        questions = {
          preTest: [
            {
              question: 'ดูภาพ แล้วเลือกพยัญชนะต้นของภาพนี้ (เลือกตอบ 1 ข้อ)',
              options: ['ด', 'ม', 'ป', 'ฮ'],
              correctAnswer: 2,
              explanation: 'ภาพนี้คือ "ปลา" ขึ้นต้นด้วยพยัญชนะ "ป"',
              imageUrl: '/แบบทดสอบ/บทที่3/ปลา.png'
            },
            {
              question: 'เลือกพยัญชนะที่อยู่ในกลุ่ม ด ถึง ม (เลือกหลายคำตอบ)',
              options: ['ป', 'ฟ', 'ร', 'ส'],
              correctAnswer: [0, 1], // Multiple choice: ป และ ฟ
              explanation: 'พยัญชนะในกลุ่ม ด ถึง ม คือ ด, ต, ถ, ท, ธ, น, บ, ป, ผ, ฝ, พ, ฟ, ภ, ม',
              isMultipleChoice: true,
              imageOptions: [
                '/แบบทดสอบ/บทที่3/ป.png',
                '/แบบทดสอบ/บทที่3/ฟ.png',
                '/แบบทดสอบ/บทที่3/ร.png',
                '/แบบทดสอบ/บทที่3/ส.png'
              ]
            },
            generateRandomMatchingQuestion(allPairs, allConsonants, allWords, 3)
          ],
          postTest: [] // จะใช้ preTest แทน
        };
      }
      // บทที่ 4: พยัญชนะ ย–ฮ
      else if (orderIndex === 4 || lessonTitle.includes('พยัญชนะ ย–ฮ')) {
        // All available pairs for this lesson - only use words that have actual images
        const allPairs = [
          { left: 'ฮ', leftImage: '/แบบทดสอบ/บทที่4/ฮ.png', right: 'ฮิปโป', rightImage: '/แบบทดสอบ/บทที่4/ฮิปโป.png' },
          { left: 'ล', leftImage: '/แบบทดสอบ/บทที่4/ล.png', right: 'ลิง', rightImage: '/แบบทดสอบ/บทที่4/ลิง.png' }
        ];
        const allConsonants = ['ฮ', 'ล'];
        const allWords = ['ฮิปโป', 'ลิง'];

        questions = {
          preTest: [
            {
              question: 'ดูภาพ แล้วเลือกพยัญชนะต้นของภาพนี้ (เลือกตอบ 1 ข้อ)',
              options: ['ก', 'ล', 'ช', 'ฮ'],
              correctAnswer: 1,
              explanation: 'ภาพนี้คือ "ลิง" ขึ้นต้นด้วยพยัญชนะ "ล"',
              imageUrl: '/แบบทดสอบ/บทที่4/รูปลิง.png'
            },
            {
              question: 'เลือกพยัญชนะที่อยู่ในกลุ่ม ย ถึง ฮ (เลือกหลายคำตอบ)',
              options: ['ฮ', 'ฟ', 'ล', 'ต'],
              correctAnswer: [0, 1, 2], // Multiple choice: ฮ, ฟ, ล
              explanation: 'พยัญชนะในกลุ่ม ย ถึง ฮ คือ ย, ร, ล, ว, ศ, ษ, ส, ห, ฬ, อ, ฮ',
              isMultipleChoice: true,
              imageOptions: [
                '/แบบทดสอบ/บทที่4/ฮ.png',
                '/แบบทดสอบ/บทที่4/ห.png',
                '/แบบทดสอบ/บทที่4/ล.png',
                '/แบบทดสอบ/บทที่4/ต.png'
              ]
            },
            generateRandomMatchingQuestion(allPairs, allConsonants, allWords, 4)
          ],
          postTest: [] // จะใช้ preTest แทน
        };
      }
      // บทที่ 5-8: สระ
      else if (orderIndex >= 5 && orderIndex <= 8) {
        if (orderIndex === 5 || lessonTitle.includes('สระ อา')) {
          // All available pairs for this lesson - use rightImage as leftImage fallback
          const allPairs = [
            { left: 'ป', leftImage: '/แบบทดสอบ/บทที่5/ปลา.png', right: 'ปลา', rightImage: '/แบบทดสอบ/บทที่5/ปลา.png' },
            { left: 'ต', leftImage: '/แบบทดสอบ/บทที่5/ตา.png', right: 'ตา', rightImage: '/แบบทดสอบ/บทที่5/ตา.png' },
            { left: 'ก', leftImage: '/แบบทดสอบ/บทที่5/กา.png', right: 'กา', rightImage: '/แบบทดสอบ/บทที่5/กา.png' },
            { left: 'ข', leftImage: '/แบบทดสอบ/บทที่5/ขา.png', right: 'ขา', rightImage: '/แบบทดสอบ/บทที่5/ขา.png' }
          ];
          const allConsonants = ['ป', 'ต', 'ก', 'ข'];
          const allWords = ['ปลา', 'ตา', 'กา', 'ขา'];

          questions = {
            preTest: [
              {
                question: 'ดูภาพแล้วเลือกคำที่ตรงกับภาพนี้ (เลือกตอบ 1 ข้อ)',
                options: ['กือ', 'งา', 'กา', 'กี'],
                correctAnswer: 2,
                explanation: 'ภาพนี้คือ "กา"',
                imageUrl: '/แบบทดสอบ/บทที่5/กา.png'
              },
              {
                question: 'ภาพนี้ใช้สระอะไรในการสะกด (เลือกตอบ 1 ข้อ)',
                options: ['สระอิ', 'สระอา', 'สระอู', 'สระอี'],
                correctAnswer: 1,
                explanation: 'ภาพนี้คือ "ขา" ใช้สระอาในการสะกด',
                imageUrl: '/แบบทดสอบ/บทที่5/ขา.png'
              },
              generateRandomMatchingQuestion(allPairs, allConsonants, allWords, 5)
            ],
            postTest: [] // จะใช้ preTest แทน
          };
        } else if (orderIndex === 6 || lessonTitle.includes('สระ อี')) {
          // All available pairs for this lesson - use rightImage as leftImage fallback
          const allPairs = [
            { left: 'ห', leftImage: '/แบบทดสอบ/บทที่6/หนี.png', right: 'หนี', rightImage: '/แบบทดสอบ/บทที่6/หนี.png' },
            { left: 'ต', leftImage: '/แบบทดสอบ/บทที่6/ตี.png', right: 'ตี', rightImage: '/แบบทดสอบ/บทที่6/ตี.png' },
            { left: 'ผ', leftImage: '/แบบทดสอบ/บทที่6/ผี.png', right: 'ผี', rightImage: '/แบบทดสอบ/บทที่6/ผี.png' },
            { left: 'ห', leftImage: '/แบบทดสอบ/บทที่6/หีบ.png', right: 'หีบ', rightImage: '/แบบทดสอบ/บทที่6/หีบ.png' }
          ];
          const allConsonants = ['ห', 'ต', 'ผ'];
          const allWords = ['หนี', 'ตี', 'ผี', 'หีบ'];

          questions = {
            preTest: [
              {
                question: 'ดูภาพแล้วเลือกคำที่ตรงกับภาพนี้ (เลือกตอบ 1 ข้อ)',
                options: ['หนี', 'ตา', 'ผี', 'ป'],
                correctAnswer: 2,
                explanation: 'ภาพนี้คือ "ผี"',
                imageUrl: '/แบบทดสอบ/บทที่6/ผี.png'
              },
              {
                question: 'ภาพนี้ใช้สระอะไรในการสะกด (เลือกตอบ 1 ข้อ)',
                options: ['สระอิ', 'สระอี', 'สระอู', 'สระอา'],
                correctAnswer: 1,
                explanation: 'ภาพนี้คือ "หีบ" ใช้สระอีในการสะกด',
                imageUrl: '/แบบทดสอบ/บทที่6/หีบ.png'
              },
              generateRandomMatchingQuestion(allPairs, allConsonants, allWords, 6)
            ],
            postTest: [] // จะใช้ preTest แทน
          };
        } else if (orderIndex === 7 || lessonTitle.includes('สระ อือ')) {
          // All available pairs for this lesson - use rightImage as leftImage fallback
          const allPairs = [
            { left: 'ถ', leftImage: '/แบบทดสอบ/บทที่7/ถือ.png', right: 'ถือ', rightImage: '/แบบทดสอบ/บทที่7/ถือ.png' },
            { left: 'ด', leftImage: '/แบบทดสอบ/บทที่7/ดื้อ.png', right: 'ดื้อ', rightImage: '/แบบทดสอบ/บทที่7/ดื้อ.png' },
            { left: 'ม', leftImage: '/แบบทดสอบ/บทที่7/มือ.png', right: 'มือ', rightImage: '/แบบทดสอบ/บทที่7/มือ.png' },
            { left: 'ซ', leftImage: '/แบบทดสอบ/บทที่7/ซื้อ.png', right: 'ซื้อ', rightImage: '/แบบทดสอบ/บทที่7/ซื้อ.png' }
          ];
          const allConsonants = ['ถ', 'ด', 'ม', 'ซ'];
          const allWords = ['ถือ', 'ดื้อ', 'มือ', 'ซื้อ'];

          questions = {
            preTest: [
              {
                question: 'ดูภาพแล้วเลือกคำที่ตรงกับภาพนี้ (เลือกตอบ 1 ข้อ)',
                options: ['ถือ', 'มี', 'มือ', 'ม้า'],
                correctAnswer: 2,
                explanation: 'ภาพนี้คือ "มือ"',
                imageUrl: '/แบบทดสอบ/บทที่7/มือ.png'
              },
              {
                question: 'ภาพนี้ใช้สระอะไรในการสะกด (เลือกตอบ 1 ข้อ)',
                options: ['สระอิ', 'สระอือ', 'สระอู', 'สระอา'],
                correctAnswer: 1,
                explanation: 'ภาพนี้คือ "ซื้อ" ใช้สระอือในการสะกด',
                imageUrl: '/แบบทดสอบ/บทที่7/ซื้อ.png'
              },
              generateRandomMatchingQuestion(allPairs, allConsonants, allWords, 7)
            ],
            postTest: [] // จะใช้ preTest แทน
          };
        } else if (orderIndex === 8 || lessonTitle.includes('สระ อุ')) {
          // All available pairs for this lesson - use rightImage as leftImage fallback
          const allPairs = [
            { left: 'ต', leftImage: '/แบบทดสอบ/บทที่8/ตุ๊กตา.png', right: 'ตุ๊กตา', rightImage: '/แบบทดสอบ/บทที่8/ตุ๊กตา.png' },
            { left: 'ข', leftImage: '/แบบทดสอบ/บทที่8/ขุด.png', right: 'ขุด', rightImage: '/แบบทดสอบ/บทที่8/ขุด.png' },
            { left: 'ก', leftImage: '/แบบทดสอบ/บทที่8/กุ้ง.png', right: 'กุ้ง', rightImage: '/แบบทดสอบ/บทที่8/กุ้ง.png' },
            { left: 'ถ', leftImage: '/แบบทดสอบ/บทที่8/ถุง.png', right: 'ถุง', rightImage: '/แบบทดสอบ/บทที่8/ถุง.png' }
          ];
          const allConsonants = ['ต', 'ข', 'ก', 'ถ'];
          const allWords = ['ตุ๊กตา', 'ขุด', 'กุ้ง', 'ถุง'];

          questions = {
            preTest: [
              {
                question: 'ดูภาพแล้วเลือกคำที่ตรงกับภาพนี้ (เลือกตอบ 1 ข้อ)',
                options: ['ลุก', 'ตุ๊กตา', 'กุ้ง', 'ถุง'],
                correctAnswer: 2,
                explanation: 'ภาพนี้คือ "กุ้ง"',
                imageUrl: '/แบบทดสอบ/บทที่8/กุ้ง.png'
              },
              {
                question: 'ภาพนี้ใช้สระอะไรในการสะกด (เลือกตอบ 1 ข้อ)',
                options: ['สระอิ', 'สระอือ', 'สระอุ', 'สระอา'],
                correctAnswer: 2,
                explanation: 'ภาพนี้คือ "ถุง" ใช้สระอุในการสะกด',
                imageUrl: '/แบบทดสอบ/บทที่8/ถุง.png'
              },
              generateRandomMatchingQuestion(allPairs, allConsonants, allWords, 8)
            ],
            postTest: [] // จะใช้ preTest แทน
          };
        }
      }
      // บทที่ 9-14: คำพยางค์เดียวและการแต่งประโยค
      else if (orderIndex >= 9 && orderIndex <= 14) {
        if (orderIndex === 9 || lessonTitle.includes('คำไม่มีตัวสะกด')) {
          questions = {
            preTest: [
              {
                question: 'คำใดต่อไปนี้ไม่มีตัวสะกด?',
                options: ['มา', 'ดิน', 'มด', 'รถ'],
                correctAnswer: 0,
                explanation: 'คำว่า "มา" ไม่มีตัวสะกด'
              }
            ],
            postTest: [
              {
                question: 'คำใดต่อไปนี้ไม่มีตัวสะกด?',
                options: ['มา, โต, โบ, ดู, มี', 'ดิน, มด, รถ, กบ, คน', 'ข่า, ขา, ข้า', 'แม่มา, พ่อกิน'],
                correctAnswer: 0,
                explanation: 'คำว่า "มา, โต, โบ, ดู, มี" ไม่มีตัวสะกด'
              }
            ]
          };
        } else if (orderIndex === 10 || lessonTitle.includes('คำมีตัวสะกดตรงมาตรา')) {
          questions = {
            preTest: [
              {
                question: 'คำใดต่อไปนี้มีตัวสะกด?',
                options: ['มา', 'โต', 'ดิน', 'ดู'],
                correctAnswer: 2,
                explanation: 'คำว่า "ดิน" มีตัวสะกด'
              }
            ],
            postTest: [
              {
                question: 'คำใดต่อไปนี้มีตัวสะกดตรงมาตรา?',
                options: ['มา, โต', 'ดิน, มด, รถ, กบ, คน', 'ข่า, ขา', 'แม่มา'],
                correctAnswer: 1,
                explanation: 'คำว่า "ดิน, มด, รถ, กบ, คน" มีตัวสะกดตรงมาตรา'
              }
            ]
          };
        } else if (orderIndex === 11 || lessonTitle.includes('คำมีวรรณยุกต์')) {
          questions = {
            preTest: [
              {
                question: 'คำใดต่อไปนี้มีวรรณยุกต์?',
                options: ['ขา', 'ข่า', 'ข้า', 'ค่า'],
                correctAnswer: 1,
                explanation: 'คำว่า "ข่า" มีวรรณยุกต์เอก'
              }
            ],
            postTest: [
              {
                question: 'คำใดต่อไปนี้มีวรรณยุกต์?',
                options: ['ขา, ข่า, ข้า, ค่า', 'มา, โต', 'ดิน, มด', 'แม่มา'],
                correctAnswer: 0,
                explanation: 'คำว่า "ขา, ข่า, ข้า, ค่า" มีวรรณยุกต์'
              }
            ]
          };
        } else if (orderIndex === 12 || lessonTitle.includes('ประโยคง่าย')) {
          questions = {
            preTest: [
              {
                question: 'ประโยคง่าย 2-3 คำ มีโครงสร้างอย่างไร?',
                options: ['ประธาน + กริยา', 'ประธาน + กริยา + กรรม', 'กริยา + กรรม', 'ประธาน + กรรม'],
                correctAnswer: 0,
                explanation: 'ประโยคง่าย 2-3 คำ มีโครงสร้าง ประธาน + กริยา'
              }
            ],
            postTest: [
              {
                question: 'ประโยคใดต่อไปนี้เป็นประโยคง่าย?',
                options: ['แม่มา', 'เด็กกินข้าว', 'แม่ทำกับข้าว', 'พ่ออ่านหนังสือ'],
                correctAnswer: 0,
                explanation: 'ประโยค "แม่มา" เป็นประโยคง่าย 2 คำ'
              }
            ]
          };
        } else if (orderIndex === 13 || lessonTitle.includes('ประโยคสมบูรณ์')) {
          questions = {
            preTest: [
              {
                question: 'ประโยคสมบูรณ์มีโครงสร้างอย่างไร?',
                options: ['ประธาน + กริยา', 'ประธาน + กริยา + กรรม', 'กริยา + กรรม', 'ประธาน + กรรม'],
                correctAnswer: 1,
                explanation: 'ประโยคสมบูรณ์มีโครงสร้าง ประธาน + กริยา + กรรม'
              }
            ],
            postTest: [
              {
                question: 'ประโยคใดต่อไปนี้เป็นประโยคสมบูรณ์?',
                options: ['แม่มา', 'เด็กกินข้าว', 'พ่อกิน', 'แม่ทำ'],
                correctAnswer: 1,
                explanation: 'ประโยค "เด็กกินข้าว" เป็นประโยคสมบูรณ์'
              }
            ]
          };
        } else if (orderIndex === 14 || lessonTitle.includes('ประโยคขยาย')) {
          questions = {
            preTest: [
              {
                question: 'คำเชื่อมใดใช้เชื่อมประโยค?',
                options: ['และ', 'แต่', 'เพราะ', 'ถูกทุกข้อ'],
                correctAnswer: 3,
                explanation: 'คำเชื่อม "และ", "แต่", "เพราะ" ใช้เชื่อมประโยคได้'
              }
            ],
            postTest: [
              {
                question: 'ประโยคใดใช้คำเชื่อม?',
                options: ['แม่มา', 'เด็กกินข้าว', 'พ่ออ่านหนังสือและน้องวาดรูป', 'แม่ทำกับข้าว'],
                correctAnswer: 2,
                explanation: 'ประโยค "พ่ออ่านหนังสือและน้องวาดรูป" ใช้คำเชื่อม "และ"'
              }
            ]
          };
        }
      }

      // Default questions if no match
      if (!questions || !questions.preTest || questions.preTest.length === 0) {
        questions = {
          preTest: [
            {
              question: `คุณรู้จักเนื้อหาใน${lessonTitle}หรือไม่?`,
              options: ['รู้จัก', 'ไม่รู้จัก', 'ไม่แน่ใจ', 'อยากเรียนรู้'],
              correctAnswer: 3,
              explanation: 'แบบทดสอบนี้จะช่วยประเมินความรู้ก่อนเรียน'
            }
          ],
          postTest: [
            {
              question: `คุณเข้าใจเนื้อหาใน${lessonTitle}แล้วหรือไม่?`,
              options: ['เข้าใจแล้ว', 'ยังไม่เข้าใจ', 'ไม่แน่ใจ', 'ต้องการทบทวน'],
              correctAnswer: 0,
              explanation: 'แบบทดสอบนี้จะช่วยประเมินความรู้หลังเรียน'
            }
          ]
        };
      }

      return questions;
    };

    const lessonQuestions = getQuestionsForLesson(lesson);

    const tests = [];

    // Pre-test
    const preTest = await this.createTest(lessonId, teacherId, {
      title: `แบบทดสอบก่อนเรียน: ${lesson.title}`,
      type: 'PRE_TEST',
      timeLimit: 10, // 10 minutes
      passingScore: 50
    });

    for (const q of lessonQuestions.preTest) {
      await this.createQuestion(preTest._id, teacherId, q);
    }

    tests.push(preTest);

    // Post-test - ใช้คำถามเดียวกันกับ pre-test
    const postTest = await this.createTest(lessonId, teacherId, {
      title: `แบบทดสอบหลังเรียน: ${lesson.title}`,
      type: 'POST_TEST',
      timeLimit: 15, // 15 minutes
      passingScore: 60
    });

    // ใช้คำถามเดียวกันกับ pre-test
    for (const q of lessonQuestions.preTest) {
      await this.createQuestion(postTest._id, teacherId, q);
    }

    tests.push(postTest);

    return tests.map(t => t.toObject());
  }

  static async generateDefaultGames(lessonId, teacherId) {
    // Check if games already exist for this lesson
    const existingGames = await Game.find({ lessonId, teacherId });
    if (existingGames.length > 0) {
      // Return existing games instead of creating duplicates
      return existingGames.map(g => g.toObject());
    }

    // Get lesson details
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    const games = [];
    const lessonTitle = lesson.title || '';

    // DYNAMIC CONTENT GENERATION
    // Check lesson content for valid vocabulary items
    let jsonStr = lesson.content || '';
    let validItems = [];

    // Only try to parse if content contains [MEDIA] tags and JSON-like structure
    if (jsonStr.includes('[MEDIA]') && (jsonStr.includes('{') || jsonStr.includes('['))) {
      // Extract JSON from [MEDIA] tags
      jsonStr = jsonStr.replaceAll('[MEDIA]', '').replaceAll('[/MEDIA]', '').trim();

      // Try to extract JSON object from content using regex
      // Look for JSON object: { ... } or { "items": [...] }
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];

        try {
          const mediaContent = JSON.parse(jsonStr);
          validItems = mediaContent.items?.filter(item =>
            item.vocabImage &&
            item.vocabImage.length > 0 &&
            item.word &&
            item.word.length > 0
          ) || [];
        } catch (e) {
          // If parsing fails, content is not valid JSON - skip silently
          console.warn(`Failed to parse lesson content for game generation (Lesson: ${lessonTitle}):`, e.message);
          validItems = [];
        }
      }
    }

    // Default empty settings
    let matchingPairs = [];
    let dragDropItems = [];
    let dragDropTargets = [];

    // Fallback if no valid items found (e.g. empty lesson)
    if (validItems.length === 0) {
      // Generic Fallback
      matchingPairs = [
        { word: 'ก', image: '/ก-ฮ/ก.png', id: '1', label: 'ก' },
        { word: 'ข', image: '/ก-ฮ/ข.png', id: '2', label: 'ข' },
        { word: 'ค', image: '/คำศัพท์บท1-8/บทที่1/ควาย.png', id: '4', label: 'ค ควาย' }
      ];
      dragDropTargets = [{ id: 't1', label: 'กลุ่ม 1' }, { id: 't2', label: 'กลุ่ม 2' }];
      dragDropItems = [{ id: 'i1', text: 'ตัวเลือก 1', groupId: 't1' }, { id: 'i2', text: 'ตัวเลือก 2', groupId: 't2' }];
    } else {
      // Generate Matching Pairs
      // Use up to 8 items
      const gameItems = validItems.slice(0, 8);
      matchingPairs = gameItems.map((item, index) => ({
        id: String(index + 1),
        word: item.word,
        image: item.vocabImage,
        label: item.label || item.word
      }));

      // Generate Drag Drop Items
      // Split into 2 groups
      const splitIndex = Math.ceil(gameItems.length / 2);
      const group1 = gameItems.slice(0, splitIndex);
      const group2 = gameItems.slice(splitIndex);

      dragDropTargets = [
        { id: 'group1', label: 'กลุ่มที่ 1', image: group1[0]?.vocabImage },
        { id: 'group2', label: 'กลุ่มที่ 2', image: group2[0]?.vocabImage }
      ];

      dragDropItems = [
        ...group1.map((item, idx) => ({ id: `g1_${idx}`, text: item.word, groupId: 'group1' })),
        ...group2.map((item, idx) => ({ id: `g2_${idx}`, text: item.word, groupId: 'group2' }))
      ];
    }

    // Matching Game
    const matchingGame = await this.createGame(lessonId, teacherId, {
      title: `จับคู่ภาพกับคำศัพท์: ${lesson.title}`,
      type: 'MATCHING',
      settings: {
        pairs: matchingPairs
      }
    });

    games.push(matchingGame);





    return games.map(g => g.toObject());
  }

  static async getTestById(testId) {
    return await DatabaseService.getTestById(testId);
  }

  static async getGameById(gameId) {
    const game = await DatabaseService.getGameById(gameId);
    if (!game) return null;

    try {
      // DYNAMIC CONTENT SYNC:
      // Instead of hardcoding arrays, we fetch the actual Lesson content
      // and regenerate the game items to match the lesson's vocabulary.

      let lessonId = game.lessonId || game.lesson_id; // Check both mostly for safety
      if (!lessonId) return game; // Can't sync without lesson

      const lesson = await Lesson.findById(lessonId);
      if (!lesson || !lesson.content) return game;

      // Parse Lesson Content
      // Format is usually [MEDIA] { "items": [...] } [/MEDIA]
      let jsonStr = lesson.content;
      let validItems = [];

      // Only try to parse if content contains [MEDIA] tags and JSON-like structure
      if (jsonStr.includes('[MEDIA]') && (jsonStr.includes('{') || jsonStr.includes('['))) {
        // Extract JSON from [MEDIA] tags
        jsonStr = jsonStr.replaceAll('[MEDIA]', '').replaceAll('[/MEDIA]', '').trim();

        // Try to extract JSON object from content using regex
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];

          try {
            const mediaContent = JSON.parse(jsonStr);
            validItems = mediaContent.items?.filter(item =>
              item.vocabImage &&
              item.vocabImage.length > 0 &&
              item.word &&
              item.word.length > 0
            ) || [];
          } catch (e) {
            // If parsing fails, content is not valid JSON - skip silently
            console.warn(`Failed to parse lesson content for game sync (Game: ${gameId}):`, e.message);
            validItems = [];
          }
        }
      }

      if (validItems.length < 3) return game; // Not enough content to generate a game

      // --- REGENERATE GAME SETTINGS DYNAMICALLY ---
      let newSettings = { ...game.settings };
      let isDirty = false;

      // 1. MATCHING GAME
      if (game.type === 'MATCHING') {
        // Generate pairs from ALL valid items in the lesson
        // This ensures we use the "Real Images" from the lesson
        const currentPairs = game.settings.pairs || [];

        // Heuristic: If current pairs are few/broken OR we want to force-sync
        // We'll regenerate if the count mismatches or contains generic data
        // But to be safe and "Always Correct", let's just regenerate if it looks generic/broken
        // or if the user explicitly requested "Use Real Images".
        // Let's check for broken/generic images to trigger the patch.
        const isBroken = (img) => !img || img.length < 5 || img === '🦅' || img === '🦵' || img === '🚫';
        const hasBrokenImages = currentPairs.some(p => isBroken(p.image));

        if (hasBrokenImages || currentPairs.length === 0) {
          console.log(`Auto-syncing Matching Game ${gameId} with Lesson Content...`);

          // Create pairs from lesson items
          newSettings.pairs = validItems.map((item, index) => ({
            id: String(index + 1),
            word: item.word,
            image: item.vocabImage, // Use the real vocabulary image (Object)
            label: item.label || item.word
          }));

          // Limit to reasonable number if too many (e.g. 8)
          if (newSettings.pairs.length > 8) {
            newSettings.pairs = newSettings.pairs.slice(0, 8);
          }

          isDirty = true;
        }
      }

      // 2. DRAG DROP GAME
      else if (game.type === 'DRAG_DROP') {
        // Drag Drop usually separates into Groups (e.g. Animals vs Objects, or Letter Groups)
        // This is harder to auto-generate purely from a list without category metadata.
        // However, for Grade 1, we often group by "Has Image" vs "No Image" or just split valid items into 2 arbitrary groups for sorting?
        // OR, we can just use the "Hardcoded Logic" ONLY for categorizing, but use "Dynamic Data" for the items?
        //
        // Actually, the Lesson 1/2/3 specific games had specific categories (Chicken vs Egg, Animals vs Objects).
        // We can try to preserve the *Categories* (Targets) but refresh the *Items*.

        // For now, let's just patch the 'items' to ensure they have text, 
        // and ensure 'targets' have images if possible.

        const items = game.settings.items || [];

        // Check 1: Generic Placeholders
        const hasGenericItems = items.some(i => i.text === 'คำที่ 1' || i.text === 'ตัวเลือก 1');

        // Check 2: Homeless Items (Items that don't belong to any target zone)
        // This fixes games that have "Egg" words when only "Chicken" box is shown
        const targetImages = (game.settings.targets || []).map(t => t.image);
        const hasHomelessItems = game.type === 'DRAG_DROP' && items.some(item => {
          const match = validItems.find(v => v.word === (item.text || item.word));
          // If item has a vocabImage, but that image IS NOT in the targets -> It's homeless
          return match && match.vocabImage && !targetImages.includes(match.vocabImage);
        });

        if (hasGenericItems || hasHomelessItems) {
          console.log(`Auto-syncing DragDrop Game ${gameId} with Lesson Content...`);

          // Strategy: One Zone Per Concept (Max 4)
          // This ensures every item has a matching visual target (e.g. Chicken -> Chicken Box)
          // Avoids confusion like "Why does Snake go in Egg box?"
          const distinctImages = [...new Set(validItems.map(i => i.vocabImage).filter(Boolean))];

          // Limit to 4 zones to keep UI clean (2x2 grid)
          const selectedImages = distinctImages.slice(0, 4);

          newSettings.targets = selectedImages.map((img, idx) => ({
            id: `group${idx + 1}`,
            label: `กลุ่มที่ ${idx + 1}`,
            image: img
          }));

          // Only include items that match the selected zones
          const matchingItems = validItems.filter(i => selectedImages.includes(i.vocabImage));

          newSettings.items = matchingItems.map((item, idx) => {
            const targetIndex = selectedImages.indexOf(item.vocabImage);
            return {
              id: `item_${idx}`,
              text: item.word,
              groupId: `group${targetIndex + 1}`
            };
          });

          isDirty = true;
        }
      }

      if (isDirty) {
        game.settings = newSettings;
        await Game.updateOne({ _id: game._id || game.id }, { settings: newSettings });
      }

    } catch (e) {
      console.error('Dynamic Game Sync failed:', e);
      // Fallback: return original game if sync fails
    }

    return game;
  }

  static async updateLessonOrder(lessonId, order, teacherId) {
    const lesson = await Lesson.findOne({ _id: lessonId, teacherId });
    if (!lesson) {
      throw new Error('ไม่พบบทเรียน');
    }

    lesson.orderIndex = order;
    await lesson.save();

    return lesson.toObject();
  }

  static async generateDefaultLessons(classroomId, teacherId) {
    // Check if lessons already exist for this classroom
    const existingLessons = await Lesson.find({ classroomId, teacherId });
    if (existingLessons.length > 0) {
      return existingLessons.map(l => l.toObject());
    }

    const lessons = [];

    // พยัญชนะ 4 บท
    lessons.push({
      title: 'บทที่ 1: รู้จักพยัญชนะ ก–ง',
      content: `[MEDIA]
{"items": [
  {"word": "ก", "image": "/ก-ฮ/ก.png", "vocabImage": "/คำศัพท์บท1-8/บทที่1/ไก่.png", "label": "ก ไก่"},
  {"word": "ข", "image": "/ก-ฮ/ข.png", "vocabImage": "/คำศัพท์บท1-8/บทที่1/ไข่.png", "label": "ข ไข่"},
  {"word": "ฃ", "image": "/ก-ฮ/ฃ.png", "vocabImage": null, "label": "ฃ ขวด"},
  {"word": "ค", "image": "/ก-ฮ/ค.png", "vocabImage": "/คำศัพท์บท1-8/บทที่1/ควาย.png", "label": "ค ควาย"},
  {"word": "ฅ", "image": "/ก-ฮ/ฅ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่1/คน.png", "label": "ฅ คน"},
  {"word": "ฆ", "image": "/ก-ฮ/ฆ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่1/ระฆัง.png", "label": "ฆ ระฆัง"},
  {"word": "ง", "image": "/ก-ฮ/ง.png", "vocabImage": "/คำศัพท์บท1-8/บทที่1/งู.png", "label": "ง งู"},
  {"word": "กา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/กา.png", "label": "ก อา กา"},
  {"word": "ขา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/ขา.png", "label": "ข อา ขา"},
  {"word": "งา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/งา.png", "label": "ง อา งา"},
  {"word": "ไก่", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/ไก่.png", "label": "ไก่"},
  {"word": "ไข่", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/ไข่.png", "label": "ไข่"},
  {"word": "ควาย", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/ควาย.png", "label": "ควาย"},
  {"word": "คน", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/คน.png", "label": "คน"},
  {"word": "ระฆัง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/ระฆัง.png", "label": "ระฆัง"},
  {"word": "งู", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่1/งู.png", "label": "งู"}
]}
[/MEDIA]`,
      category: 'consonants',
      chapter: '1',
      orderIndex: 1
    });

    lessons.push({
      title: 'บทที่ 2: รู้จักพยัญชนะ จ–ณ',
      content: `[MEDIA]
{"items": [
  {"word": "จ", "image": "/ก-ฮ/จ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่2/จาน.png", "label": "จ จาน"},
  {"word": "ฉ", "image": "/ก-ฮ/ฉ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่2/ฉิ่ง.png", "label": "ฉ ฉิ่ง"},
  {"word": "ช", "image": "/ก-ฮ/ช.png", "vocabImage": "/คำศัพท์บท1-8/บทที่2/ช้าง.png", "label": "ช ช้าง"},
  {"word": "ซ", "image": "/ก-ฮ/ซ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่2/ซอ.png", "label": "ซ โซ่"},
  {"word": "ฌ", "image": "/ก-ฮ/ฌ.png", "vocabImage": null, "label": "ฌ เฌอ"},
  {"word": "ญ", "image": "/ก-ฮ/ญ.png", "vocabImage": null, "label": "ญ หญิง"},
  {"word": "ฎ", "image": "/ก-ฮ/ฎ.png", "vocabImage": null, "label": "ฎ ชฎา"},
  {"word": "ฏ", "image": "/ก-ฮ/ฏ.png", "vocabImage": null, "label": "ฏ ปฏัก"},
  {"word": "ฐ", "image": "/ก-ฮ/ฐ.png", "vocabImage": null, "label": "ฐ ฐาน"},
  {"word": "ฑ", "image": "/ก-ฮ/ฑ.png", "vocabImage": null, "label": "ฑ มณโฑ"},
  {"word": "ฒ", "image": "/ก-ฮ/ฒ.png", "vocabImage": null, "label": "ฒ ผู้เฒ่า"},
  {"word": "ณ", "image": "/ก-ฮ/ณ.png", "vocabImage": null, "label": "ณ เณร"},
  {"word": "จาน", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่2/จาน.png", "label": "จาน"},
  {"word": "ฉิ่ง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่2/ฉิ่ง.png", "label": "ฉิ่ง"},
  {"word": "ช้าง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่2/ช้าง.png", "label": "ช้าง"},
  {"word": "ซอ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่2/ซอ.png", "label": "ซอ"}
]}
[/MEDIA]`,
      category: 'consonants',
      chapter: '1',
      orderIndex: 2
    });

    lessons.push({
      title: 'บทที่ 3: รู้จักพยัญชนะ ด–ม',
      content: `[MEDIA]
{"items": [
  {"word": "ด", "image": "/ก-ฮ/ด.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/เด็ก.png", "label": "ด เด็ก"},
  {"word": "ต", "image": "/ก-ฮ/ต.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/เต่า.png", "label": "ต เต่า"},
  {"word": "ถ", "image": "/ก-ฮ/ถ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ถุง.png", "label": "ถ ถุง"},
  {"word": "ท", "image": "/ก-ฮ/ท.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ทหาร.png", "label": "ท ทหาร"},
  {"word": "ธ", "image": "/ก-ฮ/ธ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ธง.png", "label": "ธ ธง"},
  {"word": "น", "image": "/ก-ฮ/น.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/หนู.png", "label": "น หนู"},
  {"word": "บ", "image": "/ก-ฮ/บ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ใบไม้.png", "label": "บ ใบไม้"},
  {"word": "ป", "image": "/ก-ฮ/ป.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ปลา.png", "label": "ป ปลา"},
  {"word": "ผ", "image": "/ก-ฮ/ผ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ผึ้ง.png", "label": "ผ ผึ้ง"},
  {"word": "ฝ", "image": "/ก-ฮ/ฝ.png", "vocabImage": null, "label": "ฝ ฝา"},
  {"word": "พ", "image": "/ก-ฮ/พ.png", "vocabImage": null, "label": "พ พาน"},
  {"word": "ฟ", "image": "/ก-ฮ/ฟ.png", "vocabImage": null, "label": "ฟ ฟัน"},
  {"word": "ภ", "image": "/ก-ฮ/ภ.png", "vocabImage": null, "label": "ภ สำเภา"},
  {"word": "ม", "image": "/ก-ฮ/ม.png", "vocabImage": "/คำศัพท์บท1-8/บทที่3/ม้า.png", "label": "ม ม้า"},
  {"word": "เด็ก", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/เด็ก.png", "label": "เด็ก"},
  {"word": "เต่า", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/เต่า.png", "label": "เต่า"},
  {"word": "ถุง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ถุง.png", "label": "ถุง"},
  {"word": "ทหาร", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ทหาร.png", "label": "ทหาร"},
  {"word": "ธง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ธง.png", "label": "ธง"},
  {"word": "หนู", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/หนู.png", "label": "หนู"},
  {"word": "ใบไม้", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ใบไม้.png", "label": "ใบไม้"},
  {"word": "ปลา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ปลา.png", "label": "ปลา"},
  {"word": "ผึ้ง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ผึ้ง.png", "label": "ผึ้ง"},
  {"word": "ม้า", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่3/ม้า.png", "label": "ม้า"}
]}
[/MEDIA]`,
      category: 'consonants',
      chapter: '1',
      orderIndex: 3
    });

    lessons.push({
      title: 'บทที่ 4: พยัญชนะ ย–ฮ',
      content: `[MEDIA]
{"items": [
  {"word": "ย", "image": "/ก-ฮ/ย.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/ยักษ์.png", "label": "ย ยักษ์"},
  {"word": "ร", "image": "/ก-ฮ/ร.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/เรือ.png", "label": "ร เรือ"},
  {"word": "ล", "image": "/ก-ฮ/ล.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/ลิง.png", "label": "ล ลิง"},
  {"word": "ว", "image": "/ก-ฮ/ว.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/แหวน.png", "label": "ว แหวน"},
  {"word": "ศ", "image": "/ก-ฮ/ศ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/ศาลา.png", "label": "ศ ศาลา"},
  {"word": "ษ", "image": "/ก-ฮ/ษ.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/ฤาษี.png", "label": "ษ ฤาษี"},
  {"word": "ส", "image": "/ก-ฮ/ส.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/เสือ.png", "label": "ส เสือ"},
  {"word": "ห", "image": "/ก-ฮ/ห.png", "vocabImage": "/คำศัพท์บท1-8/บทที่4/หีบ.png", "label": "ห หีบ"},
  {"word": "ฬ", "image": "/ก-ฮ/ฬ.png", "vocabImage": null, "label": "ฬ จุฬา"},
  {"word": "อ", "image": "/ก-ฮ/อ.png", "vocabImage": null, "label": "อ อ่าง"},
  {"word": "ฮ", "image": "/ก-ฮ/ฮ.png", "vocabImage": null, "label": "ฮ นกฮูก"},
  {"word": "ยักษ์", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/ยักษ์.png", "label": "ยักษ์"},
  {"word": "เรือ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/เรือ.png", "label": "เรือ"},
  {"word": "ฤาษี", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/ฤาษี.png", "label": "ฤาษี"},
  {"word": "ลิง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/ลิง.png", "label": "ลิง"},
  {"word": "ศาลา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/ศาลา.png", "label": "ศาลา"},
  {"word": "เสือ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/เสือ.png", "label": "เสือ"},
  {"word": "หีบ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/หีบ.png", "label": "หีบ"},
  {"word": "แหวน", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่4/แหวน.png", "label": "แหวน"}
]}
[/MEDIA]`,
      category: 'consonants',
      chapter: '1',
      orderIndex: 4
    });

    // สระ 4 บท
    lessons.push({
      title: 'บทที่ 5: สระ อา',
      content: `[MEDIA]
{
  "intro": {
    "audio": "วันนี้เราจะมาเรียนรู้สระอา ออ–อา",
    "text": "วันนี้เราจะมาเรียนรู้สระอา ออ–อา",
    "vowelImage": "/สระา/สระา.png",
    "vowelText": "า",
    "vowelSound": "ออ–อา"
  },
  "blending": [
    {"consonant": "ก", "vowel": "อา", "word": "กา", "audio": "กอ–อา กา"},
    {"consonant": "ข", "vowel": "อา", "word": "ขา", "audio": "ขอ–อา ขา"},
    {"consonant": "ง", "vowel": "อา", "word": "งา", "audio": "งอ–อา งา"}
  ],
  "vocabulary": [
    {"word": "กา", "image": "/คำศัพท์บท1-8/บทที่5/กา.png"},
    {"word": "ขา", "image": "/คำศัพท์บท1-8/บทที่5/ขา.png"},
    {"word": "งา", "image": "/คำศัพท์บท1-8/บทที่5/งา.png"},
    {"word": "ตา", "image": "/คำศัพท์บท1-8/บทที่5/ตา.png"},
    {"word": "ปลา", "image": "/คำศัพท์บท1-8/บทที่5/ปลา.png"},
    {"word": "จาน", "image": "/คำศัพท์บท1-8/บทที่5/จาน.png"}
  ],
  "items": [
  {"word": "กา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่5/กา.png", "label": "กา"},
  {"word": "ขา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่5/ขา.png", "label": "ขา"},
  {"word": "งา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่5/งา.png", "label": "งา"},
  {"word": "ตา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่5/ตา.png", "label": "ตา"},
  {"word": "ปลา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่5/ปลา.png", "label": "ปลา"},
  {"word": "งา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่5/งา.png", "label": "งา"},
  {"word": "ตา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่5/ตา.png", "label": "ตา"},
  {"word": "จาน", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่5/จาน.png", "label": "จาน"}
  ]
}
[/MEDIA]`,
      category: 'vowels',
      chapter: '2',
      orderIndex: 5
    });

    lessons.push({
      title: 'บทที่ 6: สระ อี',
      content: `[MEDIA]
{
  "intro": {
    "audio": "วันนี้เราจะมาเรียนรู้สระอี ออ–อี",
    "text": "วันนี้เราจะมาเรียนรู้สระอี ออ–อี",
    "vowelImage": "/สระอี/สระอี.png",
    "vowelText": "ี",
    "vowelSound": "ออ–อี"
  },
  "blending": [
    {"consonant": "ก", "vowel": "อี", "word": "กี", "audio": "กอ–อี กี"},
    {"consonant": "ข", "vowel": "อี", "word": "ขี", "audio": "ขอ–อี ขี"},
    {"consonant": "ด", "vowel": "อี", "word": "ดี", "audio": "ดอ–อี ดี"}
  ],
  "vocabulary": [
    {"word": "ผี", "image": "/คำศัพท์บท1-8/บทที่6/ผี.png"},
    {"word": "ตี", "image": "/คำศัพท์บท1-8/บทที่6/ตี.png"},
    {"word": "ปี", "image": "/คำศัพท์บท1-8/บทที่6/ปี.png"},
    {"word": "หีบ", "image": "/คำศัพท์บท1-8/บทที่6/หีบ.png"},
    {"word": "หนี", "image": "/คำศัพท์บท1-8/บทที่6/หนี.png"},
    {"word": "มีด", "image": "/คำศัพท์บท1-8/บทที่6/มีด.png"}
  ],
  "items": [
  {"word": "ผี", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่6/ผี.png", "label": "ผี"},
  {"word": "ตี", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่6/ตี.png", "label": "ตี"},
  {"word": "ปี", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่6/ปี.png", "label": "ปี"},
  {"word": "หีบ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่6/หีบ.png", "label": "หีบ"},
  {"word": "หนี", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่6/หนี.png", "label": "หนี"},
  {"word": "ตี", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่6/ตี.png", "label": "ตี"},
  {"word": "ปี", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่6/ปี.png", "label": "ปี"},
  {"word": "มีด", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่6/มีด.png", "label": "มีด"}
  ]
}
[/MEDIA]`,
      category: 'vowels',
      chapter: '2',
      orderIndex: 6
    });

    lessons.push({
      title: 'บทที่ 7: สระ อือ',
      content: `[MEDIA]
{
  "intro": {
    "audio": "วันนี้เราจะมาเรียนรู้สระอือ ออ–อือ",
    "text": "วันนี้เราจะมาเรียนรู้สระอือ ออ–อือ",
    "vowelImage": "/สระอือ/สระอือ.png",
    "vowelText": "ื",
    "vowelSound": "ออ–อือ"
  },
  "blending": [
    {"consonant": "ม", "vowel": "อือ", "word": "มือ", "audio": "มอ–อือ มือ"},
    {"consonant": "ถ", "vowel": "อือ", "word": "ถือ", "audio": "ถอ–อือ ถือ"},
    {"consonant": "ห", "vowel": "อือ", "word": "หือ", "audio": "หอ–อือ หือ"}
  ],
  "vocabulary": [
    {"word": "มือ", "image": "/คำศัพท์บท1-8/บทที่7/มือ.png"},
    {"word": "ถือ", "image": "/คำศัพท์บท1-8/บทที่7/ถือ.png"},
    {"word": "ดื้อ", "image": "/คำศัพท์บท1-8/บทที่7/ดื้อ.png"},
    {"word": "ซื้อ", "image": "/คำศัพท์บท1-8/บทที่7/ซื้อ.png"},
    {"word": "เรือ", "image": "/คำศัพท์บท1-8/บทที่7/เรือ.png"},
    {"word": "เสือ", "image": "/คำศัพท์บท1-8/บทที่7/เสือ.png"}
  ],
  "items": [
  {"word": "มือ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่7/มือ.png", "label": "มือ"},
  {"word": "ถือ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่7/ถือ.png", "label": "ถือ"},
  {"word": "ดื้อ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่7/ดื้อ.png", "label": "ดื้อ"},
  {"word": "ซื้อ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่7/ซื้อ.png", "label": "ซื้อ"},
  {"word": "เรือ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่7/เรือ.png", "label": "เรือ"},
  {"word": "เสือ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่7/เสือ.png", "label": "เสือ"},
  {"word": "ดื้อ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่7/ดื้อ.png", "label": "ดื้อ"},
  {"word": "ซื้อ", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่7/ซื้อ.png", "label": "ซื้อ"}
  ]
}
[/MEDIA]`,
      category: 'vowels',
      chapter: '2',
      orderIndex: 7
    });

    lessons.push({
      title: 'บทที่ 8: สระ อุ',
      content: `[MEDIA]
{
  "intro": {
    "audio": "วันนี้เราจะมาเรียนรู้สระอุ ออ–อุ",
    "text": "วันนี้เราจะมาเรียนรู้สระอุ ออ–อุ",
    "vowelImage": "/สระอุ/สระอุ.png",
    "vowelText": "ุ",
    "vowelSound": "ออ–อุ"
  },
  "blending": [
    {"consonant": "ก", "vowel": "อุ", "word": "กุ", "audio": "กอ–อุ กุ"},
    {"consonant": "ค", "vowel": "อุ", "word": "คุ", "audio": "คอ–อุ คุ"},
    {"consonant": "ท", "vowel": "อุ", "word": "ทุ", "audio": "ทอ–อุ ทุ"}
  ],
  "vocabulary": [
    {"word": "ถุง", "image": "/คำศัพท์บท1-8/บทที่8/ถุง.png"},
    {"word": "ขุด", "image": "/คำศัพท์บท1-8/บทที่8/ขุด.png"},
    {"word": "จุก", "image": "/คำศัพท์บท1-8/บทที่8/จุก.png"},
    {"word": "ลุก", "image": "/คำศัพท์บท1-8/บทที่8/ลุก.png"},
    {"word": "ตุ๊กตา", "image": "/คำศัพท์บท1-8/บทที่8/ตุ๊กตา.png"},
    {"word": "กุ้ง", "image": "/คำศัพท์บท1-8/บทที่8/กุ้ง.png"}
  ],
  "items": [
  {"word": "ถุง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่8/ถุง.png", "label": "ถุง"},
  {"word": "ขุด", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่8/ขุด.png", "label": "ขุด"},
  {"word": "จุก", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่8/จุก.png", "label": "จุก"},
  {"word": "ลุก", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่8/ลุก.png", "label": "ลุก"},
  {"word": "ตุ๊กตา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่8/ตุ๊กตา.png", "label": "ตุ๊กตา"},
  {"word": "กุ้ง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่8/กุ้ง.png", "label": "กุ้ง"},
  {"word": "ตุ๊กตา", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่8/ตุ๊กตา.png", "label": "ตุ๊กตา"},
  {"word": "กุ้ง", "image": null, "vocabImage": "/คำศัพท์บท1-8/บทที่8/กุ้ง.png", "label": "กุ้ง"}
  ]
}
[/MEDIA]`,
      category: 'vowels',
      chapter: '2',
      orderIndex: 8
    });

    // Create all lessons in parallel
    const createdLessons = await Promise.all(lessons.map(async (lessonData) => {
      const lesson = await this.createLesson({
        ...lessonData,
        classroomId,
        teacherId
      });

      // Generate default tests and games for each lesson in parallel
      try {
        await Promise.all([
          this.generateDefaultTests(lesson._id, teacherId),
          this.generateDefaultGames(lesson._id, teacherId)
        ]);
        console.log(`✅ Created tests and games for lesson: ${lesson.title}`);
      } catch (error) {
        console.error(`❌ Error creating tests/games for lesson ${lesson.title}:`, error);
      }
      return lesson;
    }));

    return createdLessons;
  }
}
