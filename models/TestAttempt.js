import mongoose from 'mongoose';

const TestAttemptSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true,
    index: true
  },
  answers: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  score: {
    type: Number
  },
  isPassed: {
    type: Boolean,
    default: false,
    index: true
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  timeSpent: {
    type: Number
  },
  completedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'test_attempts',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

TestAttemptSchema.virtual('id').get(function() {
  return this._id.toString();
});

TestAttemptSchema.index({ studentId: 1, testId: 1 });

export const TestAttempt = mongoose.model('TestAttempt', TestAttemptSchema);
