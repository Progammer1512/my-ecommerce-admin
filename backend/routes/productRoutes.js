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

// 🟢 BULK / SPECIAL ROUTES (Dynamic /:id Route se hamesha UPAR rahenge)
router.post('/bulk-upload', upload.single('file'), bulkUploadProducts);
router.post('/bulk-delete', bulkDeleteProducts);

// 📦 STANDARD CRUD ROUTES
router.get('/', getProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;