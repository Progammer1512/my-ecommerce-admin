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

// 🟢 IMPORT AdminUser MODEL FOR DEDICATED ADMIN MANAGEMENT
const { AdminUser } = require('./models/User');

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

// 🟢 DIRECT ADMIN USERS MANAGEMENT API ENDPOINTS (Dedicated adminusers table)
app.get('/api/auth/admin-users', async (req, res) => {
  try {
    const admins = await AdminUser.find({}).sort({ createdAt: -1 });
    return res.status(200).json(admins);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch admin users' });
  }
});

app.post('/api/auth/admin-users', async (req, res) => {
  try {
    const { name, email, password, role, mobile } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await AdminUser.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: 'Admin user with this email already exists!' });
    }

    const newAdmin = new AdminUser({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      role: role || 'Admin',
      mobile: mobile || ''
    });

    await newAdmin.save();
    const updatedAdmins = await AdminUser.find({}).sort({ createdAt: -1 });
    return res.status(201).json({ message: 'Admin created successfully', admins: updatedAdmins });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create admin user: ' + error.message });
  }
});

app.put('/api/auth/admin-users/:id', async (req, res) => {
  try {
    const { name, email, password, role, mobile } = req.body;
    const admin = await AdminUser.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    if (name) admin.name = name.trim();
    if (email) admin.email = email.trim().toLowerCase();
    if (password && password.trim() !== '') admin.password = password.trim();
    if (role) admin.role = role;
    if (mobile !== undefined) admin.mobile = mobile;

    await admin.save();
    const updatedAdmins = await AdminUser.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Admin updated successfully', admins: updatedAdmins });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update admin user: ' + error.message });
  }
});

app.delete('/api/auth/admin-users/:id', async (req, res) => {
  try {
    await AdminUser.findByIdAndDelete(req.params.id);
    const updatedAdmins = await AdminUser.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Admin deleted successfully', admins: updatedAdmins });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete admin user' });
  }
});

// 🟢 REPLACED OLD SIGNUP ROUTE: Redirects signup requests directly to adminusers collection
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, mobile } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await AdminUser.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: 'Admin user with this email already exists!' });
    }

    let assignedRole = role ? role.trim() : 'SuperAdmin';

    const newAdmin = new AdminUser({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      role: assignedRole,
      mobile: mobile || ''
    });

    await newAdmin.save();
    console.log(`✅ SUCCESS: Signup routed directly to 'adminusers' collection -> ${cleanEmail}`);

    return res.status(201).json({ 
      message: 'Admin registered successfully in adminusers collection!', 
      user: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({ message: 'Server signup error: ' + error.message });
  }
});

// ROUTER MIDDLEWARES
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
// Note: authRoutes signup is fully bypassed and handled above to prevent any users table leaks!

// Root Healthcheck Route
app.get('/', (req, res) => {
  res.send('🚀 TechStore Backend Server is Active & Healthy!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running smoothly on port ${PORT}`));