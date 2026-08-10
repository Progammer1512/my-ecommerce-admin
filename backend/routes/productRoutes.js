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

// Product Routes
router.get('/', getProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

// Bulk CSV Upload Route
router.post('/bulk-upload', upload.single('file'), bulkUploadProducts);

module.exports = router;