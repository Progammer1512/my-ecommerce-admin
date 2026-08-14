const mongoose = require('mongoose');

// Main Store Customer Schema (Only for store shoppers)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, default: 'google_authenticated_user' },
  mobile: { type: String, default: '' },
  address: { type: String, default: '' },
  pincode: { type: String, default: '' },
  googleId: { type: String, default: '' },
  avatar: { type: String, default: '' },
  isVerified: { type: Boolean, default: true }
}, { timestamps: true });

// Strictly binds to 'users' collection in MongoDB
module.exports = mongoose.models.User || mongoose.model('User', userSchema, 'users');