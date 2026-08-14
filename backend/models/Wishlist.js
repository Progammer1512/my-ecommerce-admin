const mongoose = require('mongoose');

const wishlistRecordSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  userName: { type: String, default: '' },
  mobile: { type: String, default: '' },
  wishlistItems: { type: Array, default: [] }
}, { timestamps: true });

module.exports = mongoose.models.WishlistRecord || mongoose.model('WishlistRecord', wishlistRecordSchema, 'wishlistrecords');