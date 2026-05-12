import mongoose from 'mongoose';

const LessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['consonants', 'vowels', 'tones', 'words'],
    default: 'consonants'
  },
  chapter: {
    type: Number,
    default: 1
  },
  orderIndex: {
    type: Number,
    required: true,
    index: true
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true,
    index: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
    index: true
  },
  audioUrl: {
    type: String
  },
  imageUrl: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date
  },
  steps: [{
    type: {
      type: String,
      enum: ['content', 'vocabulary', 'activity'],
      required: true
    },
    title: String,
    content: String,
    imageUrl: String,
    audioUrl: String,
    activityType: String,
    activityData: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  collection: 'lessons',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

LessonSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Index for sorting lessons
LessonSchema.index({ classroomId: 1, orderIndex: 1 });
LessonSchema.index({ classroomId: 1, isDeleted: 1, orderIndex: 1 });

export const Lesson = mongoose.model('Lesson', LessonSchema);