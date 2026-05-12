import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Student } from './models/Student.js';
import { Classroom } from './models/Classroom.js';
import { User } from './models/User.js';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb+srv://skxngna_db_user:Cookie30302547@bearthai-cluster.g4cyx64.mongodb.net/test';

const stripPrefixOnly = (fullName) => {
  if (!fullName) return '';
  let name = fullName.trim();
  name = name.replace(/^(ด\.?ช\.?|ด\.?ญ\.?|เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง)\s*/i, '');
  return name.trim();
};

async function migrateAndCleanup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(DATABASE_URL);
    console.log('Connected.');

    const students = await Student.find({}).sort({ createdAt: 1 });
    console.log(`Found ${students.length} total students.`);

    console.log('Migrating names to firstName/lastName fields...');
    for (const student of students) {
        const fullNameWithoutPrefix = stripPrefixOnly(student.name);
        const nameParts = fullNameWithoutPrefix.split(/\s+/).filter(p => p.length > 0);
        
        if (nameParts.length >= 2) {
            student.firstName = nameParts[0].trim();
            student.lastName = nameParts.slice(1).join(' ').trim();
        } else {
            student.firstName = fullNameWithoutPrefix;
            student.lastName = '';
        }
        await student.save({ validateBeforeSave: false });
    }
    console.log('Migration complete.');

    // Now cleanup duplicates based on the new fields
    const updatedStudents = await Student.find({}).sort({ createdAt: 1 });
    const seenKeys = new Set();
    const toDelete = [];

    for (const student of updatedStudents) {
      const key = `${student.firstName}|${student.lastName}`.toLowerCase().replace(/[\s\.]/g, '');
      if (seenKeys.has(key)) {
        toDelete.push(student);
      } else {
        seenKeys.add(key);
      }
    }

    console.log(`Identified ${toDelete.length} duplicates to delete.`);

    for (const student of toDelete) {
      console.log(`Deleting duplicate: ${student.name} (${student.studentCode})`);
      if (student.userId) {
        await User.findByIdAndDelete(student.userId);
      }
      await Student.findByIdAndDelete(student._id);
    }

    console.log('Duplicates deleted. Starting re-sequencing...');

    const classrooms = await Classroom.find({});
    for (const classroom of classrooms) {
      const roomStudents = await Student.find({ classroomId: classroom._id }).sort({ createdAt: 1 });
      console.log(`Re-sequencing room: ${classroom.name} (${roomStudents.length} students)`);
      
      let roomCode = String(classroom._id).slice(-2).toLowerCase();
      const digits = classroom.name.replace(/\D/g, '');
      if (digits) roomCode = digits;

      for (let i = 0; i < roomStudents.length; i++) {
        const st = roomStudents[i];
        const newSequenceNumber = String(i + 1).padStart(3, '0');
        const newStudentCode = `stu${roomCode}-${newSequenceNumber}`;
        
        if (st.studentCode !== newStudentCode) {
          st.studentCode = newStudentCode;
          st.qrCode = newStudentCode;
          await st.save();
          
          if (st.userId) {
            const user = await User.findById(st.userId);
            if (user) {
              user.email = `${newStudentCode}@bearthai.local`;
              await user.save();
            }
          }
        }
      }
    }

    console.log('Cleanup and Re-sequencing complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

migrateAndCleanup();
