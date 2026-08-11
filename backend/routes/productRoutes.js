const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUploadProducts,
  bulkDeleteProducts
} = require('../controllers/productController');

// 🟢 FIX: Dynamic /:id route se pehle bulk endpoints rakhein
router.post('/bulk-upload', upload.single('file'), bulkUploadProducts);
router.post('/bulk-delete', bulkDeleteProducts);

// Standard Routes
router.get('/', getProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;