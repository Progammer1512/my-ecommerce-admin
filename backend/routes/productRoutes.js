const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUploadProducts
} = require('../controllers/productController');

// 🟢 FIX: /bulk-upload Route hamesha /:id se UPAR hona chahiye
router.post('/bulk-upload', upload.single('file'), bulkUploadProducts);

// Product Standard Routes
router.get('/', getProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;