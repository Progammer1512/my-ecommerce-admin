const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discount: Number,
  category: String,
  maxUsage: Number,
  usedCount: { type: Number, default: 0 },
  status: String,
  
  // 🟢 TARGETED DISCOUNT FIELD: ONLY SPECIFIC USER CAN SEE & USE THIS COUPON
  targetUserEmail: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Coupon', couponSchema);