const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');

// Image Single Upload Endpoint
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

module.exports = router;