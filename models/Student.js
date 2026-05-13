import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    index: true
  },
  studentCode: {
    type: String,
    unique: true,
    index: true
  },
  qrCode: {
    type: String,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'ต้องระบุชื่อ'],
    validate: {
      validator: function(v) {
        return /^(ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s?/.test(v);
      },
      message: 'ต้องมีคำนำหน้า (ด.ช., ด.ญ., เด็กชาย, เด็กหญิง)'
    }
  },
  firstName: {
    type: String,
    index: true
  },
  lastName: {
    type: String,
    index: true
  },
  // Gamification fields
  stars: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  stamps: { type: Number, default: 0 },
  totalStars: { type: Number, default: 0 },
  totalMedals: { type: Number, default: 0 },
  totalBadges: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: 'students',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

StudentSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const Student = mongoose.model('Student', StudentSchema);
