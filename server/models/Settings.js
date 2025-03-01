const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  settings: {
    font: {
      type: String,
      default: 'sans-serif'
    },
    fontSize: {
      type: Number,
      default: 16
    },
    letterSpacing: {
      type: Number,
      default: 0.12
    },
    wordSpacing: {
      type: Number,
      default: 0.16
    },
    lineSpacing: {
      type: Number,
      default: 1.5
    },
    textColor: {
      type: String,
      default: '#000000'
    },
    backgroundColor: {
      type: String,
      default: '#f8f8f8'
    },
    rewriteEnabled: {
      type: Boolean,
      default: true
    },
    textToSpeechEnabled: {
      type: Boolean,
      default: true
    },
    aiModel: {
      type: String,
      default: 'gpt-4o'
    },
    simplificationLevel: {
      type: String,
      default: 'medium'
    },
    phoneticsEnabled: {
      type: Boolean,
      default: false
    }
  },
  apiKeys: {
    openai: String,
    anthropic: String,
    google: String,
    deepseek: String
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Settings', SettingsSchema);