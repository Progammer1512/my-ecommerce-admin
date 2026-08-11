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

// 🟢 BULK ENDPOINTS (MUST BE PLACED BEFORE /:id ROUTE)
router.post('/bulk-upload', upload.single('file'), bulkUploadProducts);
router.post('/bulk-delete', bulkDeleteProducts);

// STANDARD ROUTES
router.get('/', getProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;