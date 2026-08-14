const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true,
        default: 'General'
    },
    // 🟢 Primary Cover Image (मुख्य फ़्रंट इमेज)
    image: {
        type: String,
        default: ''
    },
    // 📸 Multiple Product Gallery Images (आगे, पीछे, ऊपर, नीचे के सभी ऐंगल्स)
    images: {
        type: [String],
        default: []
    },
    stock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    countInStock: {
        type: Number,
        default: 10,
        min: 0
    },
    rating: {
        type: Number,
        default: 4.5
    },
    // 🟢 Display Ranking (1 is top priority, 2 is second...)
    priority: {
        type: Number,
        default: 100,
        min: 1
    }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);