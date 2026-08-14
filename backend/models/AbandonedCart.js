const mongoose = require('mongoose');

const abandonedCartSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  userName: { type: String, default: '' },
  mobile: { type: String, default: '' },
  cartItems: { type: Array, default: [] }
}, { timestamps: true });

module.exports = mongoose.models.AbandonedCart || mongoose.model('AbandonedCart', abandonedCartSchema, 'abandonedcarts');