import mongoose from 'mongoose';

const GameAttemptSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
    index: true
  },
  score: {
    type: Number
  },
  level: {
    type: Number,
    default: 1
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
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  completedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'game_attempts',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

GameAttemptSchema.virtual('id').get(function() {
  return this._id.toString();
});

GameAttemptSchema.index({ studentId: 1, gameId: 1 });

export const GameAttempt = mongoose.model('GameAttempt', GameAttemptSchema);
