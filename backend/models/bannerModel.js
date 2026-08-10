 const mongoose = require('mongoose');

const bannerSchema = mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  badge: { type: String, default: 'PROMO' },
  img: { type: String, required: true },
  bg: { type: String, default: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Banner', bannerSchema);