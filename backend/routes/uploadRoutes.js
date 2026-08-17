const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const upload = require('../middleware/uploadMiddleware');

// 🎥 MULTER STORAGE FOR DIRECT PRODUCT VIDEOS (MP4, MOV, WEBM)
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const videoFileFilter = (req, file, cb) => {
    const filetypes = /mp4|mov|webm|mkv|avi/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('video/');

    if (extname || mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only video files (MP4, MOV, WebM, MKV) are allowed!'));
    }
};

const uploadVideo = multer({
    storage: videoStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB Max Video Size
    fileFilter: videoFileFilter
});

// 📸 Image Single Upload Endpoint (Existing)
router.post('/', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please upload an image file" });
        }
        res.status(200).json({
            message: "Image uploaded successfully!",
            imageUrl: `/${req.file.path.replace(/\\/g, "/")}`
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// 🎥 Video Direct File Upload Endpoint (NEW)
router.post('/video', uploadVideo.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please select a valid video file to upload" });
        }
        const cleanPath = `/${req.file.path.replace(/\\/g, "/")}`;
        res.status(200).json({
            message: "Video uploaded successfully!",
            videoUrl: cleanPath
        });
    } catch (error) {
        res.status(500).json({ message: "Video Upload Error", error: error.message });
    }
});

module.exports = router;