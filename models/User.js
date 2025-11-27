const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  googleId: {
    type: String,
    sparse: true
  },
  avatar: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Remove ALL pre-save middleware that's causing issues
// We'll handle password hashing manually

// Manual password hashing method
userSchema.methods.setPassword = async function(password) {
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(password, salt);
  this.updatedAt = new Date();
  return this.save();
};

// Compare password method
userSchema.methods.comparePasswordAsync = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

// Update timestamps manually before saving
userSchema.methods.updateTimestamps = function() {
  this.updatedAt = new Date();
  return this;
};

module.exports = mongoose.model('User', userSchema);