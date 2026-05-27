const mongoose = require('mongoose');

const VoiceNoteSchema = new mongoose.Schema({
  timestamp: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  groupName: {
    type: String,
    required: true
  },
  vnNumber: {
    type: Number,
    required: true
  },
  senderType: {
    type: String,
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  transcript: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  actionItems: {
    type: [String],
    default: []
  },
  audioFileName: {
    type: String,
    required: true
  },
  audioData: {
    type: String,
    required: false
  },
  syncStatus: {
    type: String,
    default: 'Local Only'
  }
}, {
  timestamps: true // Automatically manage createdAt and updatedAt
});

// Configure toJSON to map _id to id when returned to frontend
VoiceNoteSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  }
});

module.exports = mongoose.model('VoiceNote', VoiceNoteSchema);
