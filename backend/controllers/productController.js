const Product = require('../models/Product');
const fs = require('fs');
const csv = require('csv-parser');

// Get All Products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create Product
exports.createProduct = async (req, res) => {
  try {
    const { name, price, category, description, image, stock } = req.body;
    
    const finalStock = !isNaN(Number(stock)) ? Number(stock) : 10;

    const product = new Product({
      name,
      price,
      category,
      description,
      image,
      stock: finalStock
    });
    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  try {
    const { name, price, category, description, image, stock } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      product.name = name !== undefined ? name : product.name;
      product.price = price !== undefined ? Number(price) : product.price;
      product.category = category !== undefined ? category : product.category;
      product.description = description !== undefined ? description : product.description;
      product.image = image !== undefined ? image : product.image;
      
      // 🔧 STRICT FIX: Ensure stock updates properly even if it is 0
      if (stock !== undefined && stock !== '' && !isNaN(Number(stock))) {
        product.stock = Number(stock);
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

// Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk CSV Upload
exports.bulkUploadProducts = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a CSV file' });
  }

  const products = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const parsedStock = !isNaN(Number(row.stock)) ? Number(row.stock) : 10;
      products.push({
        name: row.name,
        price: Number(row.price),
        category: row.category || 'General',
        description: row.description || '',
        image: row.image || 'https://via.placeholder.com/150',
        stock: parsedStock
      });
    })
    .on('end', async () => {
      try {
        await Product.insertMany(products);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(201).json({ 
          message: `🎉 Successfully imported ${products.length} products!`,
          count: products.length 
        });
      } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: 'Bulk upload failed: ' + error.message });
      }
    })
    .on('error', (error) => {
      res.status(500).json({ message: 'Error reading CSV file: ' + error.message });
    });
};