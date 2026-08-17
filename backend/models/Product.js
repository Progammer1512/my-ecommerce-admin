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
    // 🟢 Full Category Hierarchy Trail: ["Electronics", "Computers", "Storage", "Internal Hard Disks"]
    categoryPath: {
        type: [String],
        default: []
    },
    // 📸 Main Product Cover & Multi-Angle Gallery
    image: {
        type: String,
        default: ''
    },
    images: {
        type: [String],
        default: []
    },
    // 🎥 Main Product Video Support (Uploads & YouTube/External links)
    video: {
        url: { type: String, default: '' },
        videoType: { 
            type: String, 
            enum: ['file', 'youtube', 'none'], 
            default: 'none' 
        },
        thumbnail: { type: String, default: '' }
    },
    // 🟢 Dynamic Parameter Names defined by Admin: ["Capacity", "Speed"] or ["Size", "Color", "Weight"]
    dynamicAttributeNames: {
        type: [String],
        default: []
    },
    // 🟢 Dynamic Variants with Custom Pricing, Stock & Dedicated Multi-Image Gallery + Variant Video
    variants: {
        type: [{
            attributes: {
                type: Map,
                of: String,
                default: {}
            },
            color: { type: String, default: '' },
            size: { type: String, default: '' },
            price: { type: Number, required: true },
            stock: { type: Number, default: 0 },
            image: { type: String, default: '' },      // Variant Cover Photo
            images: { type: [String], default: [] },   // 📸 Variant Multi-Angle Gallery Images
            video: {                                   // 🎥 Dedicated Variant Video
                url: { type: String, default: '' },
                videoType: { type: String, enum: ['file', 'youtube', 'none'], default: 'none' }
            }
        }],
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
    priority: {
        type: Number,
        default: 100,
        min: 1
    }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);