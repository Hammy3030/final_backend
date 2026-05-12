import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

// Import Models
import { Classroom } from './models/Classroom.js';
import { Student } from './models/Student.js';
import { User } from './models/User.js';

const migrate = async () => {
    try {
        console.log('Connecting to MongoDB...');
        // Force use of 'test' database as discovered by research
        const uri = process.env.DATABASE_URL.replace('/bearthai?', '/test?');
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        console.log(`Connected to database: ${db.databaseName}`);

        const classroomsCol = db.collection('classrooms');
        const studentsCol = db.collection('students');
        const usersCol = db.collection('users');

        const distinctClassroomIds = await studentsCol.distinct('classroomId');
        console.log(`Found students belonging to ${distinctClassroomIds.length} distinct classrooms. Starting re-sequencing...`);

        for (const classroomId of distinctClassroomIds) {
            const room = await classroomsCol.findOne({ _id: classroomId });
            const roomName = room ? room.name : `Room-${String(classroomId).slice(-4)}`;
            console.log(`\nProcessing Classroom ID: ${classroomId} (${roomName})`);
            
            // Extract digits from room name for roomCode
            let roomCode = roomName.replace(/\D/g, '');
            if (!roomCode) {
                roomCode = String(classroomId).slice(-2).toLowerCase();
            }

            // Get students sorted by creation date
            const students = await studentsCol.find({ classroomId: classroomId }).sort({ createdAt: 1 }).toArray();
            console.log(`- Found ${students.length} students`);

            for (let i = 0; i < students.length; i++) {
                const st = students[i];
                const seq = String(i + 1).padStart(3, '0');
                const newCode = `stu${roomCode}-${seq}`;

                console.log(`  Updating ${st.name}: ${st.studentCode} -> ${newCode}`);
                
                await studentsCol.updateOne(
                    { _id: st._id },
                    { $set: { studentCode: newCode, qrCode: newCode } }
                );

                if (st.userId) {
                    await usersCol.updateOne(
                        { _id: st.userId },
                        { $set: { email: `${newCode}@bearthai.local` } }
                    );
                }
            }
        }

        console.log('\n✅ All students have been re-sequenced successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

migrate();
