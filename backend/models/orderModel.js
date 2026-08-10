const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Jaise ORD795169
  orderItems: { type: Array, required: true },
  shippingAddress: { type: Object, required: true },
  paymentMethod: { type: String, default: 'Cash on Delivery (COD)' },
  totalPrice: { type: Number, required: true },
  userEmail: { type: String, default: 'guest@techstore.com' },
  status: { type: String, default: 'Processing' },
  returnRequest: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);