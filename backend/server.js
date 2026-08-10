const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const connectDB = require('./config/db');
const Banner = require('./models/bannerModel');
const Review = require('./models/reviewModel');
const Coupon = require('./models/couponModel');
const Product = require('./models/Product');

// ROLE BASED ACCESS CONTROL MIDDLEWARE IMPORT
const { protect, authorizeRoles } = require('./middleware/authMiddleware');

const app = express();

// Connect Database
connectDB();

// 1. TOP PRIORITY: CORS CONFIGURATION (Prevents Network & Origin Block Errors)
app.use(cors());

// 2. EXPRESS BODY PARSERS (High Payload Limit for Compressed Base64 Data)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. SECURITY HEADERS
app.use(helmet({ crossOriginResourcePolicy: false }));

// Multer Memory Storage Setup
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// DIRECT IMAGE UPLOAD ROUTES
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file selected' });
    }
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    console.log('📸 Upload Received & Processed Successfully');
    return res.status(200).json({ imageUrl: base64Image });
  } catch (error) {
    console.error('Upload Endpoint Error:', error);
    return res.status(500).json({ message: 'Server upload error: ' + error.message });
  }
});

app.post('/api/products/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file selected' });
    }
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    return res.status(200).json({ imageUrl: base64Image });
  } catch (error) {
    return res.status(500).json({ message: 'Server upload error' });
  }
});

// BULK PRODUCTS UPLOAD ROUTE
app.post('/api/products/bulk-upload', upload.any(), async (req, res) => {
  try {
    let productsToInsert = [];

    if (req.body && req.body.products) {
      productsToInsert = req.body.products;
      if (typeof productsToInsert === 'string') {
        try { productsToInsert = JSON.parse(productsToInsert); } catch(e){}
      }
    } else if (req.files && req.files.length > 0) {
      const csvData = req.files[0].buffer.toString('utf8');
      const lines = csvData.split(/\r?\n/);
      if (lines.length === 0) {
        return res.status(400).json({ message: 'CSV File is empty' });
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/(^"|"$)/g, '').trim());
        const product = {};
        headers.forEach((header, index) => {
          product[header] = values[index];
        });
        productsToInsert.push(product);
      }
    } else {
      return res.status(400).json({ message: 'No file or data payload received' });
    }

    let insertedCount = 0;
    for (const item of productsToInsert) {
      if (item.name || item.title) {
        await Product.create({
          name: item.name || item.title,
          price: Number(item.price) || 0,
          category: item.category || 'General',
          description: item.description || '',
          image: item.image || item.imageUrl || '',
          countInStock: Number(item.stock) || Number(item.countInStock) || 10,
          rating: Number(item.rating) || 4.5
        });
        insertedCount++;
      }
    }

    const allProducts = await Product.find({}).sort({ createdAt: -1 });
    return res.status(201).json({ message: `Successfully uploaded ${insertedCount} products!`, products: allProducts });
  } catch (error) {
    return res.status(500).json({ message: `SERVER ERROR: ${error.message}` });
  }
});

// BANNERS API
app.get('/api/banners', async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ createdAt: -1 });
    return res.status(200).json(banners);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch banners' });
  }
});

app.post('/api/banners', async (req, res) => {
  try {
    const { title, subtitle, badge, img, bg } = req.body;
    
    if (!title || !img) {
      return res.status(400).json({ message: 'Title and Image are required' });
    }

    const newBanner = new Banner({
      title: title || 'Special Offer',
      subtitle: subtitle || '',
      badge: badge || 'PROMO',
      img: img || '',
      bg: bg || 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)'
    });

    await newBanner.save();
    const updatedBanners = await Banner.find({}).sort({ createdAt: -1 });
    console.log('✅ New Banner Published to Mongo DB:', newBanner.title);
    return res.status(201).json({ message: 'Banner added successfully!', banners: updatedBanners });
  } catch (error) {
    console.error('Banner Error:', error);
    return res.status(500).json({ message: 'Failed to add banner: ' + error.message });
  }
});

app.delete('/api/banners/:id', async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    const updatedBanners = await Banner.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Banner deleted successfully!', banners: updatedBanners });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete banner' });
  }
});

// REVIEWS API
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({}).sort({ createdAt: -1 });
    return res.status(200).json(reviews);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { orderId, customerName, customerEmail, rating, comment, items } = req.body;
    const newReview = new Review({
      orderId,
      customerName: customerName || 'Verified Buyer',
      customerEmail: customerEmail || 'guest@techstore.com',
      rating: Number(rating) || 5,
      comment: comment || '',
      items: items || [],
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    });

    await newReview.save();
    const allReviews = await Review.find({}).sort({ createdAt: -1 });
    return res.status(201).json({ message: 'Review submitted successfully!', reviews: allReviews });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit review' });
  }
});

// COUPONS API
app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res.status(200).json(coupons);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch coupons' });
  }
});

app.post('/api/coupons', async (req, res) => {
  try {
    const { code, discount, category, maxUsage, status } = req.body;
    if (!code || !discount) {
      return res.status(400).json({ message: 'Code and Discount percentage are required' });
    }

    const formattedCode = code.toUpperCase().trim();
    let coupon = await Coupon.findOne({ code: formattedCode });

    if (coupon) {
      coupon.discount = Number(discount) || 10;
      coupon.category = category || 'All';
      coupon.maxUsage = Number(maxUsage) || 100;
      coupon.status = status || 'Active';
      await coupon.save();
    } else {
      coupon = new Coupon({
        code: formattedCode,
        discount: Number(discount) || 10,
        category: category || 'All',
        maxUsage: Number(maxUsage) || 100,
        usedCount: 0,
        status: status || 'Active'
      });
      await coupon.save();
    }

    const allCoupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res.status(201).json({ message: 'Coupon published successfully!', coupons: allCoupons });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create promo coupon' });
  }
});

app.post('/api/coupons/use', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code required' });

    const formattedCode = code.toUpperCase().trim();
    const coupon = await Coupon.findOne({ code: formattedCode });

    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save();
      return res.status(200).json({ message: 'Coupon usage recorded', coupon });
    }
    return res.status(404).json({ message: 'Coupon not found' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record usage' });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    const allCoupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Coupon deleted', coupons: allCoupons });
  } catch (error) {
    return res.status(500).json({ message: 'Delete coupon failed' });
  }
});

// ROUTER MIDDLEWARES
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));

// Root Healthcheck Route
app.get('/', (req, res) => {
  res.send('🚀 TechStore Backend Server is Active & Healthy!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running smoothly on port ${PORT}`));