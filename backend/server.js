const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const connectDB = require('./config/db');
const Banner = require('./models/bannerModel');
const Review = require('./models/reviewModel');
const Coupon = require('./models/couponModel');
const Product = require('./models/Product');

// ROLE BASED ACCESS CONTROL MIDDLEWARE IMPORT
const { protect, authorizeRoles } = require('./middleware/authMiddleware');

const app = express();

// Database Connection
connectDB();

// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security & CORS
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());

// Make uploads folder publicly accessible with CORS headers
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Multer Disk Storage Setup
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const cleanFileName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${cleanFileName}`);
  }
});
const upload = multer({ storage });

// DYNAMIC FILE UPLOAD HANDLER FUNCTION
const handleFileUpload = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file selected' });
    }
    // DYNAMIC DOMAIN RESOLUTION (Renders relative live host automatically)
    const host = req.get('host');
    const protocol = req.protocol;
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    console.log('📸 File Uploaded Successfully:', imageUrl);
    return res.status(200).json({ imageUrl });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ message: 'Server upload error' });
  }
};

// DIRECT FILE UPLOAD ROUTES
app.post('/api/upload', protect, authorizeRoles('SuperAdmin', 'Manager'), upload.single('image'), handleFileUpload);
app.post('/api/products/upload', protect, authorizeRoles('SuperAdmin', 'Manager'), upload.single('image'), handleFileUpload);

// BULK PRODUCTS UPLOAD ROUTE (ONLY SUPERADMIN & MANAGER)
app.post('/api/products/bulk-upload', protect, authorizeRoles('SuperAdmin', 'Manager'), upload.any(), async (req, res) => {
  try {
    let productsToInsert = [];

    // 1. Check JSON Payload
    if (req.body && req.body.products) {
      productsToInsert = req.body.products;
      if (typeof productsToInsert === 'string') {
        try { productsToInsert = JSON.parse(productsToInsert); } catch(e){}
      }
    } 
    // 2. Check File Upload
    else if (req.files && req.files.length > 0) {
      const filePath = req.files[0].path;
      const csvData = fs.readFileSync(filePath, 'utf8');
      
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

    // 3. Save Products to MongoDB
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
    console.log(`📦 Bulk Upload Successful: ${insertedCount} products added to MongoDB.`);
    return res.status(201).json({ message: `Successfully uploaded ${insertedCount} products!`, products: allProducts });

  } catch (error) {
    console.error('CRITICAL BULK UPLOAD ERROR:', error);
    return res.status(500).json({ message: `SERVER ERROR: ${error.message}` });
  }
});

// PERMANENT MONGODB BANNERS API ENDPOINTS

// 1. Get All Banners (All Authenticated Users)
app.get('/api/banners', async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ createdAt: -1 });
    return res.status(200).json(banners);
  } catch (error) {
    console.error('Fetch Banners Error:', error);
    return res.status(500).json({ message: 'Failed to fetch banners' });
  }
});

// 2. Add New Banner (SuperAdmin & Manager)
app.post('/api/banners', protect, authorizeRoles('SuperAdmin', 'Manager'), async (req, res) => {
  try {
    const { title, subtitle, badge, img, bg } = req.body;
    
    const newBanner = new Banner({
      title: title || 'Special Offer',
      subtitle: subtitle || '',
      badge: badge || 'PROMO',
      img: img || '',
      bg: bg || 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)'
    });

    await newBanner.save();
    const updatedBanners = await Banner.find({}).sort({ createdAt: -1 });
    console.log('✅ New Banner Saved to MongoDB:', newBanner.title);
    
    return res.status(201).json({ message: 'Banner added successfully!', banners: updatedBanners });
  } catch (error) {
    console.error('Banner Add Error:', error);
    return res.status(500).json({ message: 'Failed to add banner' });
  }
});

// 3. Delete Banner (ONLY SUPERADMIN)
app.delete('/api/banners/:id', protect, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    const updatedBanners = await Banner.find({}).sort({ createdAt: -1 });
    console.log(`🗑️ Banner deleted ID: ${req.params.id}`);
    
    return res.status(200).json({ message: 'Banner deleted successfully!', banners: updatedBanners });
  } catch (error) {
    console.error('Banner Delete Error:', error);
    return res.status(500).json({ message: 'Failed to delete banner' });
  }
});

// PERMANENT MONGODB REVIEWS API ENDPOINTS
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({}).sort({ createdAt: -1 });
    return res.status(200).json(reviews);
  } catch (error) {
    console.error('Fetch Reviews Error:', error);
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
    console.log('⭐ New Review Saved to MongoDB:', newReview);
    return res.status(201).json({ message: 'Review submitted successfully!', reviews: allReviews });
  } catch (error) {
    console.error('Review Save Error:', error);
    return res.status(500).json({ message: 'Failed to submit review' });
  }
});

// PERMANENT MONGODB COUPONS API ENDPOINTS

// Get All Coupons
app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res.status(200).json(coupons);
  } catch (error) {
    console.error('Fetch Coupons Error:', error);
    return res.status(500).json({ message: 'Failed to fetch coupons' });
  }
});

// Create/Update Coupon (ONLY SUPERADMIN)
app.post('/api/coupons', protect, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const { code, discount, category, maxUsage, type, status } = req.body;
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
    console.log('🏷️ Live Coupon Saved to MongoDB:', coupon);
    return res.status(201).json({ message: 'Coupon published successfully!', coupons: allCoupons });
  } catch (error) {
    console.error('Coupon Save Error:', error);
    return res.status(500).json({ message: 'Failed to create promo coupon' });
  }
});

// INCREMENT COUPON USAGE COUNT WHEN ORDER PLACED
app.post('/api/coupons/use', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code required' });

    const formattedCode = code.toUpperCase().trim();
    const coupon = await Coupon.findOne({ code: formattedCode });

    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save();
      console.log(`🎟️ Coupon ${coupon.code} Usage Updated in MongoDB: ${coupon.usedCount}/${coupon.maxUsage}`);
      return res.status(200).json({ message: 'Coupon usage recorded', coupon });
    }
    return res.status(404).json({ message: 'Coupon not found' });
  } catch (error) {
    console.error('Coupon Use Error:', error);
    return res.status(500).json({ message: 'Failed to record usage' });
  }
});

// Delete Coupon (ONLY SUPERADMIN)
app.delete('/api/coupons/:id', protect, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    const allCoupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Coupon deleted', coupons: allCoupons });
  } catch (error) {
    console.error('Coupon Delete Error:', error);
    return res.status(500).json({ message: 'Delete coupon failed' });
  }
});

// RELAXED RATE LIMITER
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: 'Too many requests, please try again later.'
});
app.use('/api/products', limiter);
app.use('/api/orders', limiter);

// API Routes
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running smoothly on port ${PORT}`));