const Product = require('../models/Product');
const fs = require('fs');
const csv = require('csv-parser');

// Helper Function: String/Number ko clean karke Sahi Number mein convert karta hai (\r aur spaces saaf karke)
const parseCleanStock = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  const cleanStr = String(val).replace(/[^0-9]/g, '');
  const num = parseInt(cleanStr, 10);
  return isNaN(num) ? 0 : num;
};

// 1. Get All Products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Create Single Product
exports.createProduct = async (req, res) => {
  try {
    const { name, price, category, description, image, stock } = req.body;
    const finalStock = parseCleanStock(stock);

    const product = new Product({
      name,
      price: Number(price) || 0,
      category: category || 'General',
      description: description || '',
      image: image || 'https://via.placeholder.com/150',
      stock: finalStock
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Update Product (Strict Dynamic Stock Sync)
exports.updateProduct = async (req, res) => {
  try {
    const { name, price, category, description, image, stock } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      if (name !== undefined) product.name = name;
      if (price !== undefined) product.price = Number(price) || 0;
      if (category !== undefined) product.category = category;
      if (description !== undefined) product.description = description;
      if (image !== undefined) product.image = image;
      
      // 🟢 STRICT FIX: Always parse & sanitize stock number
      if (stock !== undefined && stock !== null && stock !== '') {
        product.stock = parseCleanStock(stock);
      }

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Delete Single Product
exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Bulk Delete Products
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      await Product.deleteMany({ _id: { $in: ids } });
      res.json({ message: `🔥 Successfully deleted ${ids.length} selected products!` });
    } else {
      await Product.deleteMany({});
      res.json({ message: '🔥 Successfully wiped ALL products from Database!' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Bulk delete failed: ' + error.message });
  }
};

// 6. Bulk CSV Upload
exports.bulkUploadProducts = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a CSV file' });
  }

  const products = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      // Clean keys and values to avoid hidden \r or special spaces
      const cleanRow = {};
      Object.keys(row).forEach((key) => {
        cleanRow[key.trim().toLowerCase()] = row[key];
      });

      const parsedStock = parseCleanStock(cleanRow.stock);

      products.push({
        name: cleanRow.name || 'Imported Item',
        price: Number(cleanRow.price) || 0,
        category: cleanRow.category || 'General',
        description: cleanRow.description || '',
        image: cleanRow.image || 'https://via.placeholder.com/150',
        stock: parsedStock
      });
    })
    .on('end', async () => {
      try {
        await Product.insertMany(products);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(201).json({ 
          message: `🎉 Successfully imported ${products.length} products to Database!`,
          count: products.length 
        });
      } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: 'Bulk upload failed: ' + error.message });
      }
    })
    .on('error', (error) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ message: 'Error reading CSV file: ' + error.message });
    });
};