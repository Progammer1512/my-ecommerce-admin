const mongoose = require('mongoose');
const reviewSchema = new mongoose.Schema({
  orderId: String,
  customerName: String,
  customerEmail: String,
  rating: Number,
  comment: String,
  items: Array,
  date: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Review', reviewSchema);