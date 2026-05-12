import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String
  },
  actorType: {
    type: String,
    enum: ['SYSTEM', 'TEACHER', 'STUDENT'],
    default: 'SYSTEM',
    index: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  eventType: {
    type: String,
    default: 'GENERAL',
    index: true
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    default: null,
    index: true
  },
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    default: null
  },
  type: {
    type: String,
    enum: ['INFO', 'SUCCESS', 'WARNING', 'ERROR'],
    default: 'INFO'
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'notifications',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

NotificationSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Index for createdAt for sorting
NotificationSchema.index({ createdAt: -1 });
// รายการแจ้งเตือนต่อนักเรียน (อ่านยังไม่อ่าย้อนหลัง)
NotificationSchema.index({ studentId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', NotificationSchema);
