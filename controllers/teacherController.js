import { ClassroomService } from '../services/classroomService.js';
import { LessonService } from '../services/lessonService.js';
import QRCode from 'qrcode';
import { DatabaseService } from '../services/databaseService.js';
import { GoogleGenAI } from '@google/genai';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { Lesson } from '../models/Lesson.js';
import { Teacher } from '../models/Teacher.js';
import { Test } from '../models/Test.js';
import { Game } from '../models/Game.js';

export class TeacherController {
  static async getClassrooms(req, res) {
    try {
      // Check if teacher data exists
      if (!req.user.teacher || !req.user.teacher.id) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลครู กรุณาติดต่อผู้ดูแลระบบ'
        });
      }

      const classrooms = await ClassroomService.getClassroomsByTeacher(req.user.teacher.id);

      res.json({
        success: true,
        data: { classrooms }
      });
    } catch (error) {
      console.error('Get classrooms error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลห้องเรียน'
      });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { name, email, school } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้งาน'
        });
      }

      // Update basic info
      if (name) user.name = name;
      if (email) user.email = email;
      if (school) user.school = school;

      await user.save();

      // Sync with Teacher model
      await Teacher.findOneAndUpdate(
        { userId: userId },
        { name, school },
        { new: true }
      );

      res.json({
        success: true,
        message: 'อัปเดตข้อมูลส่วนตัวสำเร็จ',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            school: user.school
          }
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลส่วนตัว'
      });
    }
  }

  static async createClassroom(req, res) {
    try {
      // Check if teacher data exists
      if (!req.user.teacher || !req.user.teacher.id) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบข้อมูลครู กรุณาติดต่อผู้ดูแลระบบ'
        });
      }

      const { name, description } = req.body;

      const classroom = await ClassroomService.createClassroom(req.user.teacher.id, {
        name,
        description: description || ''
      });

      // [Requirement 1] Auto-generate Lessons, Games, Tests in background
      console.log(`[Auto-Gen] Starting background content generation for: ${classroom._id}`);
      LessonService.generateDefaultLessons(classroom._id, req.user.teacher.id)
        .then(() => console.log(`[Auto-Gen] Successfully generated content for: ${classroom._id}`))
        .catch(genError => console.error(`[Auto-Gen] Background generation failed for ${classroom._id}:`, genError));

      res.status(201).json({
        success: true,
        message: 'สร้างห้องเรียนและเนื้อหาอัตโนมัติสำเร็จ',
        data: { classroom }
      });
    } catch (error) {
      console.error('Create classroom error:', error);
      const isDuplicate = error.message && error.message.includes('ชื่อห้องเรียนซ้ำ');
      res.status(isDuplicate ? 400 : 500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างห้องเรียน'
      });
    }
  }

  static async getClassroom(req, res) {
    try {
      const classroom = await ClassroomService.getClassroomById(req.classroomId);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบห้องเรียน'
        });
      }

      res.json({
        success: true,
        data: { classroom }
      });
    } catch (error) {
      console.error('Get classroom error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลห้องเรียน'
      });
    }
  }

  static async getClassroomStudents(req, res) {
    try {
      const { classroomId } = req.params;
      const { 
        search, 
        gender, 
        progress, 
        testStatus, 
        scoreLevel, 
        gameStatus,
        sort 
      } = req.query;

      const result = await ClassroomService.getClassroomStudents(classroomId, {
        search,
        gender,
        progress,
        testStatus,
        scoreLevel,
        gameStatus,
        sort
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get classroom students error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการดึงรายชื่อนักเรียน'
      });
    }
  }

  static async getTests(req, res) {
    try {
      const { classroomId } = req.params;
      const { search, type, status, sort } = req.query;
      
      const query = { classroomId, isDeleted: false };
      
      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }
      
      if (type && type !== 'all') {
        query.type = type.toUpperCase();
      }
      
      if (status && status !== 'all') {
        query.isActive = status === 'active';
      }
      
      let sortOptions = { createdAt: -1 };
      if (sort === 'oldest') sortOptions = { createdAt: 1 };
      if (sort === 'name') sortOptions = { title: 1 };
      
      const tests = await Test.find(query).sort(sortOptions);
      
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

  static async getGames(req, res) {
    try {
      const { classroomId } = req.params;
      const { search, type, status, sort } = req.query;
      
      const query = { classroomId, isDeleted: false };
      
      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }
      
      if (type && type !== 'all') {
        query.type = type.toUpperCase();
      }
      
      if (status && status !== 'all') {
        query.isActive = status === 'active';
      }
      
      let sortOptions = { createdAt: -1 };
      if (sort === 'oldest') sortOptions = { createdAt: 1 };
      if (sort === 'name') sortOptions = { title: 1 };
      
      const games = await Game.find(query).sort(sortOptions);
      
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

  static async updateClassroom(req, res) {
    try {
      const { classroomId } = req.params;
      const { name, description } = req.body;

      const classroom = await ClassroomService.updateClassroom(
        classroomId,
        req.user.teacher.id,
        { name, description: description || '' }
      );

      res.json({
        success: true,
        message: 'อัปเดตห้องเรียนสำเร็จ',
        data: { classroom }
      });
    } catch (error) {
      console.error('Update classroom error:', error);
      const isDuplicate = error.message && error.message.includes('ชื่อห้องเรียนซ้ำ');
      res.status(isDuplicate ? 400 : 500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตห้องเรียน'
      });
    }
  }

  static async deleteClassroom(req, res) {
    try {
      const { classroomId } = req.params;

      await ClassroomService.deleteClassroom(classroomId, req.user.teacher.id);

      res.json({
        success: true,
        message: 'ลบห้องเรียนสำเร็จ'
      });
    } catch (error) {
      console.error('Delete classroom error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการลบห้องเรียน'
      });
    }
  }

  static async addStudents(req, res) {
    try {
      const { students } = req.body;
      const classroomId = req.classroomId;

      // [DEEP DEBUG] ตรวจสอบข้อมูลดิบที่ส่งเข้า addStudents
      console.log("-----------------------------------------");
      console.log("🚨 [API CALL] addStudents (Classroom Context) called");
      console.log("Original Request Body:", JSON.stringify(req.body, null, 2));

      const stripPrefix = (fullName) => {
        if (!fullName) return '';
        let name = fullName.trim();
        name = name.replace(/^(ด\.?ช\.?|ด\.?ญ\.?|เด็กชาย|เด็กหญิง)\s*/i, '');
        return name.trim();
      };

      const seenNamesInPayload = new Set();
      for (const student of students) {
        console.log("Processing student string (addStudents):", student.name);

        // 1. Validate Prefix Presence
        const prefixRegex = /^(ด\.?ช\.?|ด\.?ญ\.?|เด็กชาย|เด็กหญิง)\s?/i;
        if (!prefixRegex.test(student.name)) {
          return res.status(400).json({
            success: false,
            message: `กรุณาเลือกตัวย่อคำนำหน้าชื่อ (ด.ช., ด.ญ., เด็กชาย, เด็กหญิง)`
          });
        }

        // 2. Data Parsing: Split Firstname and Lastname
        const fullNameWithoutPrefix = stripPrefix(student.name);
        const nameParts = fullNameWithoutPrefix.split(/\s+/).filter(p => p.length > 0);

        if (nameParts.length < 2) {
          return res.status(400).json({
            success: false,
            message: `กรุณากรอกทั้งชื่อและนามสกุลให้ครบถ้วน`
          });
        }

        const firstName = nameParts[0].trim();
        const lastName = nameParts.slice(1).join(' ').trim();
        const normalizedKey = (firstName + lastName).replace(/[\s\.]/g, '').toLowerCase();

        // [LOG] ผลการแยกคำ
        console.log("✅ Parsed First Name:", `"${firstName}"`);
        console.log("✅ Parsed Last Name:", `"${lastName}"`);

        // 3. Payload Check
        if (seenNamesInPayload.has(normalizedKey)) {
          return res.status(400).json({
            success: false,
            message: `ชื่อและนามสกุลนี้มีอยู่แล้ว (ซ้ำซ้อนในรายการที่ส่งมา)`
          });
        }
        seenNamesInPayload.add(normalizedKey);

        // 4. DATABASE VALIDATION using Flexible Regex (THE FINAL GATE)
        console.log(`🔍 Searching DB for: ${firstName} ${lastName}...`);
        const existingStudent = await Student.findOne({
          firstName: { $regex: new RegExp('^' + firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
          lastName: { $regex: new RegExp('^' + lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
        });

        if (existingStudent) {
          console.log("🚨 [BACKEND] FOUND DUPLICATE IN DB!", {
            name: existingStudent.name,
            id: existingStudent._id
          });
          return res.status(400).json({
            success: false,
            message: 'ชื่อและนามสกุลนี้มีอยู่ในระบบแล้ว ไม่สามารถเพิ่มซ้ำได้'
          });
        }

        // Attach split names for ClassroomService
        student.firstName = firstName;
        student.lastName = lastName;
      }
      console.log("-----------------------------------------");

      const createdStudents = await ClassroomService.addStudentsToClassroom(classroomId, students);

      // Generate QR codes for all students
      const studentsWithQR = await Promise.all(
        createdStudents.map(async (student) => {
          const qrCodeImage = await QRCode.toDataURL(student.qrCode, {
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });

          return {
            ...student,
            qrCodeImage
          };
        })
      );

      res.status(201).json({
        success: true,
        message: `เพิ่มนักเรียน ${createdStudents.length} คนสำเร็จ`,
        data: { students: studentsWithQR }
      });
    } catch (error) {
      console.error('Add students error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มนักเรียน'
      });
    }
  }

  static async createStudents(req, res) {
    try {
      const { students, classroomId } = req.body;
      // [DEEP DEBUG] ตรวจสอบข้อมูลดิบที่รับมาจาก Frontend
      console.log("-----------------------------------------");
      console.log("🚨 [API CALL] createStudents called");
      console.log("Original Request Body:", JSON.stringify(req.body, null, 2));

      const stripPrefix = (fullName) => {
        if (!fullName) return '';
        let name = fullName.trim();
        // Regex ตัดคำนำหน้าออกให้เหลือแต่ชื่อ-นามสกุลจริงๆ
        name = name.replace(/^(ด\.?ช\.?|ด\.?ญ\.?|เด็กชาย|เด็กหญิง)\s*/i, '');
        return name.trim();
      };

      const seenNamesInPayload = new Set();
      for (const student of students) {
        console.log("Processing student string:", student.name);

        // 1. Validate Prefix Presence
        const prefixRegex = /^(ด\.?ช\.?|ด\.?ญ\.?|เด็กชาย|เด็กหญิง)\s?/i;
        if (!prefixRegex.test(student.name)) {
          return res.status(400).json({
            success: false,
            message: `กรุณาเลือกตัวย่อคำนำหน้าชื่อ (ด.ช., ด.ญ., เด็กชาย, เด็กหญิง)`
          });
        }

        // 2. Data Parsing: Split Firstname and Lastname
        const fullNameWithoutPrefix = stripPrefix(student.name);
        const nameParts = fullNameWithoutPrefix.split(/\s+/).filter(p => p.length > 0);

        if (nameParts.length < 2) {
          return res.status(400).json({
            success: false,
            message: `กรุณากรอกทั้งชื่อและนามสกุลให้ครบถ้วน`
          });
        }

        const firstName = nameParts[0].trim();
        const lastName = nameParts.slice(1).join(' ').trim();
        const normalizedKey = (firstName + lastName).replace(/[\s\.]/g, '').toLowerCase();

        // [LOG] ผลการแยกคำ
        console.log("✅ Parsed First Name:", `"${firstName}"`);
        console.log("✅ Parsed Last Name:", `"${lastName}"`);

        // 3. Payload Check (ในชุดข้อมูลเดียวกัน)
        if (seenNamesInPayload.has(normalizedKey)) {
          return res.status(400).json({
            success: false,
            message: `ชื่อและนามสกุลนี้มีอยู่แล้ว (ซ้ำซ้อนในรายการที่ส่งมา)`
          });
        }
        seenNamesInPayload.add(normalizedKey);

        // 4. DATABASE VALIDATION using Flexible Regex (ROOT FIX)
        console.log(`🔍 Searching DB for: ${firstName} ${lastName}...`);
        const existingStudent = await Student.findOne({
          firstName: { $regex: new RegExp('^' + firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
          lastName: { $regex: new RegExp('^' + lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
        });

        if (existingStudent) {
          console.log("🚨 [FOUND DUPLICATE!]", {
            id: existingStudent._id,
            name: existingStudent.name,
            firstNameInDB: existingStudent.firstName,
            lastNameInDB: existingStudent.lastName
          });
          return res.status(400).json({
            success: false,
            message: 'ชื่อและนามสกุลนี้มีอยู่ในระบบแล้ว ไม่สามารถเพิ่มซ้ำได้'
          });
        }

        console.log("✨ No duplicate found. Proceeding...");

        // แนบค่าที่แยกแล้วส่งต่อให้ Service
        student.firstName = firstName;
        student.lastName = lastName;
      }
      console.log("-----------------------------------------");

      let createdStudents;

      if (classroomId) {
        // Create students and add to classroom
        createdStudents = await ClassroomService.addStudentsToClassroom(classroomId, students);
      } else {
        // Create students without classroom
        createdStudents = await ClassroomService.createStudentsWithoutClassroom(teacherId, students);
      }

      // Generate QR codes for all students
      const studentsWithQR = await Promise.all(
        createdStudents.map(async (student) => {
          const qrCodeImage = await QRCode.toDataURL(student.qrCode, {
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });

          return {
            ...student,
            qrCodeImage
          };
        })
      );

      res.status(201).json({
        success: true,
        message: `สร้างบัญชีนักเรียน ${createdStudents.length} คนสำเร็จ`,
        data: { students: studentsWithQR }
      });
    } catch (error) {
      console.error('Create students error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างบัญชีนักเรียน'
      });
    }
  }

  static async searchStudents(req, res) {
    try {
      const { query } = req.query;
      const students = await ClassroomService.searchStudents(query);
      res.json({
        success: true,
        data: { students }
      });
    } catch (error) {
      console.error('Search students error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการค้นหานักเรียน'
      });
    }
  }

  static async assignStudents(req, res) {
    try {
      const { studentIds } = req.body;
      if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({
          success: false,
          message: 'ข้อมูลนักเรียนไม่ถูกต้อง'
        });
      }

      const result = await ClassroomService.assignStudentsToClassroom(req.classroomId, studentIds);

      res.json({
        success: true,
        message: `เพิ่มนักเรียน ${result.results.length} คนเข้าห้องเรียนสำเร็จ`,
        data: result
      });
    } catch (error) {
      console.error('Assign students error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มนักเรียนเข้าห้องเรียน'
      });
    }
  }

  static async importStudentsFromPdf(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์ PDF' });
      }

      const classroomId = req.params.classroomId;

      // 1. เรียกใช้ Gemini API ให้แกะไฟล์ PDF
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
      const filePart = {
        inlineData: {
          data: req.file.buffer.toString('base64'),
          mimeType: req.file.mimetype,
        }
      };

      const prompt = `
ดึงรายชื่อนักเรียนจากไฟล์เอกสารที่แนบมา คืนค่าผลลัพธ์เป็น JSON Array เท่านั้น ในรูปแบบนี้:
[
  { "title": "เด็กชาย", "firstName": "สมชาย", "lastName": "ใจดี" },
  { "title": "เด็กหญิง", "firstName": "สมหญิง", "lastName": "รักเรียน" }
]
* คำนำหน้า (title) ต้องเป็น: 'ด.ช.', 'ด.ญ.', 'เด็กชาย', หรือ 'เด็กหญิง' เท่านั้น
ถ้าไม่มีนามสกุล ให้ใส่ lastName เป็น string ว่าง ""
ตอบกลับมาเฉพาะ JSON เท่านั้น ห้ามมีข้อความอื่นหรือ Markdown backticks
`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: [filePart, prompt]
      });

      const responseText = response.text;
      const jsonStr = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

      let extractedData;
      try {
        extractedData = JSON.parse(jsonStr);
      } catch (e) {
        console.error("JSON Parse Error:", jsonStr);
        return res.status(500).json({ success: false, message: 'AI สกัดข้อมูลผิดรูปแบบ กรุณาลองใหม่อีกครั้ง' });
      }

      // 2. Validate Data (เช็คคำนำหน้า และ เช็คชื่อซ้ำ)
      const validPrefixes = ['ด.ช.', 'ด.ญ.', 'เด็กชาย', 'เด็กหญิง'];
      const previewData = [];
      const seenNames = new Set();

      const teacherClassrooms = await ClassroomService.getClassroomsByTeacher(req.user.teacher.id);
      const classroomIds = teacherClassrooms.map(c => c._id);

      const stripPrefix = (fullName) => {
        if (!fullName) return '';
        let name = fullName.trim();
        name = name.replace(/^(ด\.?ช\.?|ด\.?ญ\.?|เด็กชาย|เด็กหญิง)\s*/i, '');
        return name.trim();
      };

      for (const student of extractedData) {
        let isValid = true;
        let errorMessage = null;
        const fullName = `${student.title || ''}${student.firstName || ''} ${student.lastName || ''}`.trim();

        if (!student.firstName || !student.lastName) {
          isValid = false;
          errorMessage = 'กรุณากรอกชื่อและนามสกุล';
        } else {
          // Robust check logic (ROOT FIX)
          const firstName = student.firstName.trim();
          const lastName = student.lastName.trim();
          const normalizedKey = (firstName + lastName).replace(/[\s\.]/g, '').toLowerCase();

          if (seenNames.has(normalizedKey)) {
            isValid = false;
            errorMessage = 'ชื่อและนามสกุลนี้มีอยู่แล้ว';
          } else {
            // Direct DB Check using the new dedicated fields
            const existing = await Student.findOne({
              firstName: firstName,
              lastName: lastName
            });

            if (existing) {
              console.log("🚨 เจอชื่อซ้ำในฐานข้อมูล (PDF Import)!", { firstName, lastName });
              isValid = false;
              errorMessage = 'ชื่อและนามสกุลนี้มีอยู่แล้ว';
            }
          }
          if (isValid) {
            seenNames.add(normalizedKey);
            // Ensure these fields are passed along
            student.firstName = firstName;
            student.lastName = lastName;
          }
        }

        previewData.push({
          name: fullName,
          isValid,
          error: errorMessage
        });
      }

      // Return preview data
      res.json({
        success: true,
        message: 'วิเคราะห์ไฟล์ PDF สำเร็จ',
        data: {
          preview: previewData
        }
      });

    } catch (error) {
      console.error('Import students from PDF error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการนำเข้านักเรียน'
      });
    }
  }

  static async removeStudent(req, res) {
    try {
      const { studentId } = req.params;

      await ClassroomService.removeStudentFromClassroom(req.classroomId, studentId);

      res.json({
        success: true,
        message: 'ลบนักเรียนสำเร็จ'
      });
    } catch (error) {
      console.error('Remove student error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการลบนักเรียน'
      });
    }
  }

  static async resetStudentPassword(req, res) {
    try {
      const { studentId } = req.params;

      const newPassword = await ClassroomService.resetStudentPassword(req.classroomId, studentId);

      res.json({
        success: true,
        message: 'รีเซ็ตรหัสผ่านสำเร็จ',
        data: { newPassword }
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน'
      });
    }
  }

  static async getClassroomReports(req, res) {
    try {
      const { type = 'overview' } = req.query;

      const report = await ClassroomService.getClassroomReports(req.classroomId, type);

      res.json({
        success: true,
        data: { report }
      });
    } catch (error) {
      console.error('Get reports error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการดึงรายงาน'
      });
    }
  }

  static async getStudentProgress(req, res) {
    try {
      const { classroomId, studentId } = req.params;

      // Verify classroom access (already handled by middleware)
      const progress = await ClassroomService.getStudentDetailedProgress(classroomId, studentId);

      res.json({
        success: true,
        data: { progress }
      });
    } catch (error) {
      console.error('Get student progress error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลความคืบหน้าของนักเรียน'
      });
    }
  }

  static async createAnnouncement(req, res) {
    try {
      const { title, content } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: 'กรุณากรอกหัวข้อและเนื้อหา'
        });
      }

      // Create announcement
      const announcement = await DatabaseService.createAnnouncement({
        classroom_id: req.classroomId,
        teacher_id: req.user.teacher.id,
        title,
        message: content
      });

      // Get all students in classroom
      const { Student } = await import('../models/Student.js');
      const students = await Student.find({ classroomId: req.classroomId });

      // Create notifications for all students
      if (students && students.length > 0) {
        const notifications = students.map(student => ({
          studentId: student._id,
          title: 'ประกาศใหม่',
          message: title,
          type: 'INFO'
        }));

        // Create notifications using DatabaseService
        for (const notification of notifications) {
          await DatabaseService.createNotification({
            student_id: notification.studentId,
            title: notification.title,
            message: notification.message,
            actor_type: 'TEACHER',
            actor_id: req.user.teacher.id,
            event_type: 'TEACHER_ANNOUNCEMENT',
            classroom_id: req.classroomId,
            announcement_id: announcement.id,
            type: notification.type
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'ส่งประกาศสำเร็จ',
        data: { announcement }
      });
    } catch (error) {
      console.error('Create announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการส่งประกาศ'
      });
    }
  }

  static async getLessons(req, res) {
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
  }

  static async createLesson(req, res) {
    try {
      const { title, classroomId } = req.body;
      const targetClassroomId = classroomId || req.classroomId;

      // [Requirement 1] Smart Duplicate Validation: Check for duplicate chapter number or title
      const extractLessonNumber = (str) => {
        const match = str.match(/บทที่\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const newLessonNumber = extractLessonNumber(title);
      const existingLessons = await Lesson.find({ 
        classroomId: targetClassroomId,
        isDeleted: false
      });

      // Check duplicate number if input has "บทที่ X"
      if (newLessonNumber !== null) {
        const isDuplicateNumber = existingLessons.some(l => extractLessonNumber(l.title) === newLessonNumber);
        if (isDuplicateNumber) {
          return res.status(400).json({
            success: false,
            message: 'เลขบทนี้มีอยู่แล้วในระบบ กรุณาใช้เลขอื่น'
          });
        }
      }

      // Check duplicate exact title or orderIndex
      const query = {
        classroomId: targetClassroomId,
        isDeleted: false,
        $or: [{ title: title.trim() }]
      };
      
      if (req.body.orderIndex) {
        query.$or.push({ orderIndex: req.body.orderIndex });
      }

      const existingLesson = await Lesson.findOne(query);

      if (existingLesson) {
        return res.status(400).json({
          success: false,
          message: 'เลขบทหรือชื่อบทเรียนนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น'
        });
      }

      // [Requirement 2] Auto-calculate orderIndex (Max + 1)
      let finalOrderIndex = req.body.orderIndex;
      if (!finalOrderIndex) {
        const lastLesson = await Lesson.findOne({ classroomId: targetClassroomId })
          .sort({ orderIndex: -1 });
        finalOrderIndex = lastLesson ? lastLesson.orderIndex + 1 : 1;
      }

      const lessonData = {
        ...req.body,
        orderIndex: finalOrderIndex,
        classroomId: targetClassroomId,
        teacherId: req.user.teacher.id
      };

      const lesson = await LessonService.createLesson(lessonData);

      res.status(201).json({
        success: true,
        message: `สร้างบทเรียนลำดับที่ ${finalOrderIndex} สำเร็จ`,
        data: { lesson }
      });
    } catch (error) {
      console.error('Create lesson error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้างบทเรียน'
      });
    }
  }

  static async reorderLessons(req, res) {
    try {
      const { lessonOrders } = req.body; // Array of { lessonId, orderIndex }

      if (!Array.isArray(lessonOrders)) {
        return res.status(400).json({
          success: false,
          message: 'lessonOrders ต้องเป็น array'
        });
      }

      const { Lesson } = await import('../models/Lesson.js');
      const teacherId = req.user.teacher.id;

      // Update all lessons in parallel
      const updatePromises = lessonOrders.map(({ lessonId, orderIndex }) => {
        return Lesson.findOneAndUpdate(
          { _id: lessonId, teacherId },
          { orderIndex },
          { new: true }
        );
      });

      await Promise.all(updatePromises);

      res.json({
        success: true,
        message: 'อัปเดตลำดับบทเรียนสำเร็จ'
      });
    } catch (error) {
      console.error('Reorder lessons error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตลำดับบทเรียน'
      });
    }
  }

  static async updateLesson(req, res) {
    try {
      const { lessonId } = req.params;
      const lesson = await LessonService.updateLesson(lessonId, req.user.teacher.id, req.body);

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
  }

  static async deleteLesson(req, res) {
    try {
      const { lessonId } = req.params;
      await LessonService.deleteLesson(lessonId, req.user.teacher.id);

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
  }

  static async generateTests(req, res) {
    try {
      const { lessonId } = req.params;
      const teacherId = req.user.teacher.id;

      const tests = await LessonService.generateDefaultTests(lessonId, teacherId);

      res.json({
        success: true,
        message: `สร้างแบบทดสอบอัตโนมัติสำเร็จ (${tests.length} แบบทดสอบ)`,
        data: { tests }
      });
    } catch (error) {
      console.error('Generate tests error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างแบบทดสอบอัตโนมัติ'
      });
    }
  }

  static async generateGames(req, res) {
    try {
      const { lessonId } = req.params;
      const teacherId = req.user.teacher.id;

      const games = await LessonService.generateDefaultGames(lessonId, teacherId);

      res.json({
        success: true,
        message: `สร้างเกมอัตโนมัติสำเร็จ (${games.length} เกม)`,
        data: { games }
      });
    } catch (error) {
      console.error('Generate games error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างเกมอัตโนมัติ'
      });
    }
  }

  static async updateTest(req, res) {
    try {
      const { testId } = req.params;
      const { title, timeLimit, passingScore, isActive } = req.body;
      const test = await LessonService.updateTest(testId, req.user.teacher.id, {
        title,
        timeLimit,
        passingScore,
        isActive
      });
      res.json({
        success: true,
        message: 'อัปเดตแบบทดสอบสำเร็จ',
        data: { test }
      });
    } catch (error) {
      console.error('Update test error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตแบบทดสอบ'
      });
    }
  }

  static async deleteTest(req, res) {
    try {
      const { testId } = req.params;
      await LessonService.deleteTest(testId, req.user.teacher.id);

      res.json({
        success: true,
        message: 'ลบแบบทดสอบสำเร็จ (สามารถกู้คืนได้)'
      });
    } catch (error) {
      console.error('Delete test error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการลบแบบทดสอบ'
      });
    }
  }

  static async updateGame(req, res) {
    try {
      const { gameId } = req.params;
      const { title, settings, isActive } = req.body;
      const game = await LessonService.updateGame(gameId, req.user.teacher.id, {
        title,
        settings,
        isActive
      });
      res.json({
        success: true,
        message: 'อัปเดตเกมสำเร็จ',
        data: { game }
      });
    } catch (error) {
      console.error('Update game error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตเกม'
      });
    }
  }

  static async deleteGame(req, res) {
    try {
      const { gameId } = req.params;
      await LessonService.deleteGame(gameId, req.user.teacher.id);

      res.json({
        success: true,
        message: 'ลบเกมสำเร็จ (สามารถกู้คืนได้)'
      });
    } catch (error) {
      console.error('Delete game error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการลบเกม'
      });
    }
  }

  static async restoreLesson(req, res) {
    try {
      const { lessonId } = req.params;
      await LessonService.restoreLesson(lessonId, req.user.teacher.id);

      res.json({
        success: true,
        message: 'กู้คืนบทเรียนสำเร็จ'
      });
    } catch (error) {
      console.error('Restore lesson error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการกู้คืนบทเรียน'
      });
    }
  }

  static async restoreTest(req, res) {
    try {
      const { testId } = req.params;
      await LessonService.restoreTest(testId, req.user.teacher.id);

      res.json({
        success: true,
        message: 'กู้คืนแบบทดสอบสำเร็จ'
      });
    } catch (error) {
      console.error('Restore test error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการกู้คืนแบบทดสอบ'
      });
    }
  }

  static async restoreGame(req, res) {
    try {
      const { gameId } = req.params;
      await LessonService.restoreGame(gameId, req.user.teacher.id);

      res.json({
        success: true,
        message: 'กู้คืนเกมสำเร็จ'
      });
    } catch (error) {
      console.error('Restore game error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการกู้คืนเกม'
      });
    }
  }

  static async getDeletedItems(req, res) {
    try {
      const { classroomId } = req.params;
      const teacherId = req.user.teacher.id;

      // Import models
      const { Lesson } = await import('../models/Lesson.js');
      const { Test } = await import('../models/Test.js');
      const { Game } = await import('../models/Game.js');

      // Get deleted lessons, tests, and games for this classroom
      const deletedLessons = await Lesson.find({
        classroomId,
        teacherId,
        isDeleted: true
      }).sort({ deletedAt: -1 });

      const deletedTests = await Test.find({
        classroomId,
        teacherId,
        isDeleted: true
      }).sort({ deletedAt: -1 });

      const deletedGames = await Game.find({
        classroomId,
        teacherId,
        isDeleted: true
      }).sort({ deletedAt: -1 });

      res.json({
        success: true,
        data: {
          lessons: deletedLessons.map(l => l.toObject()),
          tests: deletedTests.map(t => t.toObject()),
          games: deletedGames.map(g => g.toObject())
        }
      });
    } catch (error) {
      console.error('Get deleted items error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการโหลดรายการที่ถูกลบ'
      });
    }
  }

  static async generateLessonsForAllClassrooms(req, res) {
    try {
      // Use _id (ObjectId) instead of id (string) for database queries
      const teacherId = req.user.teacher._id || req.user.teacher.id;
      const { Classroom } = await import('../models/Classroom.js');
      const { Lesson } = await import('../models/Lesson.js');
      const mongoose = await import('mongoose');

      // Get all classrooms for this teacher
      // Convert teacherId to ObjectId if it's a string
      let teacherObjectId = teacherId;
      if (typeof teacherId === 'string' && mongoose.Types.ObjectId.isValid(teacherId)) {
        teacherObjectId = new mongoose.Types.ObjectId(teacherId);
      }

      const classrooms = await Classroom.find({ teacherId: teacherObjectId });

      console.log(`Found ${classrooms.length} classrooms for teacher: ${teacherObjectId}`);

      if (classrooms.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'คุณยังไม่มีห้องเรียน'
        });
      }

      let totalCreated = 0;
      let totalSkipped = 0;

      // Generate lessons for each classroom
      for (const classroom of classrooms) {
        try {
          // Check if lessons already exist (same check as generateDefaultLessons)
          const existingLessons = await Lesson.find({
            classroomId: classroom._id,
            teacherId: teacherObjectId
          });

          console.log(`Checking classroom: ${classroom.name} (${classroom._id}), existing lessons: ${existingLessons.length}, teacherId: ${teacherObjectId}`);

          if (existingLessons.length === 0) {
            // No lessons exist, create default lessons
            console.log(`Creating lessons for classroom: ${classroom.name}...`);
            const createdLessons = await LessonService.generateDefaultLessons(classroom._id, teacherObjectId);
            console.log(`✅ Created ${createdLessons?.length || 0} lessons for classroom: ${classroom.name}`);
            totalCreated++;
          } else {
            // Lessons already exist, skip
            console.log(`⏭️  Skipped classroom: ${classroom.name} (already has ${existingLessons.length} lessons)`);
            totalSkipped++;
          }
        } catch (error) {
          console.error(`❌ Error processing classroom ${classroom.name}:`, error);
          console.error('Error details:', error.message, error.stack);
          // Continue with next classroom
        }
      }

      res.json({
        success: true,
        message: `สร้างบทเรียนอัตโนมัติให้ทุกห้องเรียนสำเร็จ (สร้างใหม่: ${totalCreated} ห้อง, ข้าม: ${totalSkipped} ห้อง)`,
        data: {
          totalClassrooms: classrooms.length,
          created: totalCreated,
          skipped: totalSkipped
        }
      });
    } catch (error) {
      console.error('Generate lessons for all classrooms error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างบทเรียนอัตโนมัติ'
      });
    }
  }

  static async createTest(req, res) {
    try {
      const { lessonId } = req.params;
      const test = await LessonService.createTest(lessonId, req.user.teacher.id, req.body);

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
  }

  static async addQuestion(req, res) {
    try {
      console.log('addQuestion payload received:', req.body);
      const { testId } = req.params;
      const question = await LessonService.createQuestion(testId, req.user.teacher.id, req.body);

      res.status(201).json({
        success: true,
        message: 'เพิ่มคำถามสำเร็จ',
        data: { question }
      });
    } catch (error) {
      console.error('Validation / Add question error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการเพิ่มคำถาม'
      });
    }
  }

  static async createGame(req, res) {
    try {
      const { lessonId } = req.params;
      const game = await LessonService.createGame(lessonId, req.user.teacher.id, req.body);

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
  }

  static async generateDefaultLessons(req, res) {
    try {
      const lessons = await LessonService.generateDefaultLessons(req.classroomId, req.user.teacher.id);

      res.status(201).json({
        success: true,
        message: `สร้างบทเรียนอัตโนมัติ ${lessons.length} บทสำเร็จ`,
        data: { lessons }
      });
    } catch (error) {
      console.error('Generate default lessons error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างบทเรียนอัตโนมัติ'
      });
    }
  }

  static async updateLessonOrder(req, res) {
    try {
      const { lessonId } = req.params;
      const { order } = req.body;

      const lesson = await LessonService.updateLessonOrder(lessonId, order, req.user.teacher.id);

      res.json({
        success: true,
        message: 'อัปเดตลำดับบทเรียนสำเร็จ',
        data: { lesson }
      });
    } catch (error) {
      console.error('Update lesson order error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตลำดับบทเรียน'
      });
    }
  }

  static async generateLessons(req, res) {
    try {
      const { classroomId } = req.params;
      const teacherId = req.user.teacher.id;

      const lessons = await LessonService.generateDefaultLessons(classroomId, teacherId);

      res.json({
        success: true,
        message: 'สร้างบทเรียนอัตโนมัติสำเร็จ',
        data: { lessons }
      });
    } catch (error) {
      console.error('Generate lessons error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดในการสร้างบทเรียน'
      });
    }
  }
}