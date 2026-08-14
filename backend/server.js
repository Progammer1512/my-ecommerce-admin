const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ==========================================
// 🗄️ MODELS IMPORT (CLEAN ARCHITECTURE)
// ==========================================
const User = require('./models/User');
const AdminUser = require('./models/AdminUser');
const Product = require('./models/Product');
const Banner = require('./models/bannerModel');
const Review = require('./models/reviewModel');
const Coupon = require('./models/couponModel');
const AbandonedCart = require('./models/AbandonedCart');
const WishlistRecord = require('./models/Wishlist');

// Safe Order Model Import
let Order;
try {
  Order = require('./models/Order');
} catch (e) {
  try {
    Order = require('./models/orderModel');
  } catch (err) {
    const orderSchema = new mongoose.Schema({
      userEmail: { type: String, lowercase: true, trim: true },
      orderItems: Array,
      shippingAddress: Object,
      paymentMethod: { type: String, default: 'Cash on Delivery (COD)' },
      totalPrice: { type: Number, required: true },
      status: { type: String, default: 'Processing' }
    }, { timestamps: true });
    Order = mongoose.models.Order || mongoose.model('Order', orderSchema, 'orders');
  }
}

const app = express();

// 1. GLOBAL MIDDLEWARES
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet({ crossOriginResourcePolicy: false }));

// Multer Storage for Media Uploads
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// =========================================================================
// 🟢 1. CUSTOMER AUTH ROUTES (STRICTLY 'users' COLLECTION)
// =========================================================================

// Customer Google Login
app.post('/api/auth/google', async (req, res) => {
  try {
    const { name, email, googleId, avatar } = req.body;
    if (!email) return res.status(400).json({ message: 'Email ID is required' });

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      user = new User({
        name: name || 'Google User',
        email: cleanEmail,
        googleId: googleId || '',
        avatar: avatar || '',
        password: 'google_authenticated_user',
        isVerified: true
      });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'techstore_secret_jwt_key_2026',
      { expiresIn: '30d' }
    );

    const cartRecord = await AbandonedCart.findOne({ userEmail: cleanEmail }).lean();
    const wishlistRecord = await WishlistRecord.findOne({ userEmail: cleanEmail }).lean();

    return res.status(200).json({
      message: 'Google Sign-In Successful',
      token,
      user: {
        ...user.toObject(),
        cart: cartRecord ? cartRecord.cartItems : [],
        wishlist: wishlistRecord ? wishlistRecord.wishlistItems : []
      }
    });
  } catch (error) {
    console.error("Customer Google Auth Error:", error);
    return res.status(500).json({ message: 'Auth error: ' + error.message });
  }
});

// Customer Email Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, mobile, address, pincode } = req.body;
    if (!email || !name) return res.status(400).json({ message: 'Name and Email are required' });

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) return res.status(400).json({ message: 'Customer account with this email already exists!' });

    const newUser = new User({
      name,
      email: cleanEmail,
      password: password || 'default_pass',
      mobile: mobile || '',
      address: address || '',
      pincode: pincode || ''
    });
    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET || 'techstore_secret_jwt_key_2026',
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      message: 'Customer Registered Successfully',
      token,
      user: { ...newUser.toObject(), cart: [], wishlist: [] }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Customer signup failed: ' + err.message });
  }
});

// Customer & Admin Combined Login Handler
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const cleanEmail = email.toLowerCase().trim();

    // Check in 'adminusers' first
    const admin = await AdminUser.findOne({ email: cleanEmail });
    if (admin && admin.password === password) {
      const token = jwt.sign(
        { id: admin._id, role: admin.role },
        process.env.JWT_SECRET || 'techstore_secret_jwt_key_2026',
        { expiresIn: '30d' }
      );
      return res.status(200).json({
        message: 'Admin login successful',
        token,
        admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
        user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
      });
    }

    // Check in 'users' (Customer)
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ message: 'User not found. Please Sign Up.' });

    if (user.password !== 'google_authenticated_user' && password && user.password !== password) {
      return res.status(401).json({ message: 'Invalid Password!' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'techstore_secret_jwt_key_2026',
      { expiresIn: '30d' }
    );

    const cartRecord = await AbandonedCart.findOne({ userEmail: cleanEmail }).lean();
    const wishlistRecord = await WishlistRecord.findOne({ userEmail: cleanEmail }).lean();

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        ...user.toObject(),
        cart: cartRecord ? cartRecord.cartItems : [],
        wishlist: wishlistRecord ? wishlistRecord.wishlistItems : []
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Login failed: ' + err.message });
  }
});

// Customer Profile & Cart/Wishlist Sync
app.put('/api/auth/profile', async (req, res) => {
  try {
    const { email, name, mobile, address, pincode, cart, wishlist } = req.body;
    if (!email) return res.status(400).json({ message: 'Email ID required' });

    const cleanEmail = email.toLowerCase().trim();
    let updatedUser = await User.findOneAndUpdate(
      { email: cleanEmail },
      { $set: { name, mobile, address, pincode } },
      { new: true, upsert: true }
    );

    if (cart !== undefined && Array.isArray(cart)) {
      await AbandonedCart.findOneAndUpdate(
        { userEmail: cleanEmail },
        { $set: { userName: updatedUser.name, mobile: updatedUser.mobile, cartItems: cart } },
        { upsert: true }
      );
    }

    if (wishlist !== undefined && Array.isArray(wishlist)) {
      await WishlistRecord.findOneAndUpdate(
        { userEmail: cleanEmail },
        { $set: { userName: updatedUser.name, mobile: updatedUser.mobile, wishlistItems: wishlist } },
        { upsert: true }
      );
    }

    return res.status(200).json({
      message: 'Profile synced in MongoDB!',
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        address: updatedUser.address,
        pincode: updatedUser.pincode
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile: ' + error.message });
  }
});

// Customer Delete Account
app.delete('/api/auth/profile', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const cleanEmail = email.toLowerCase().trim();
    await User.findOneAndDelete({ email: cleanEmail });
    await AbandonedCart.findOneAndDelete({ userEmail: cleanEmail });
    await WishlistRecord.findOneAndDelete({ userEmail: cleanEmail });

    return res.status(200).json({ message: 'Customer account permanently deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Delete account failed: ' + error.message });
  }
});

// 🟢 Fetch All Store Customers for Admin Intelligence (Supports all frontend route variants)
app.get(['/api/auth/customers', '/api/customers', '/api/admin/customers', '/api/users'], async (req, res) => {
  try {
    const users = await User.find({}, 'name email mobile address pincode createdAt').sort({ createdAt: -1 }).lean();
    
    const customers = await Promise.all(users.map(async (u) => {
      const cartRecord = await AbandonedCart.findOne({ userEmail: u.email }).lean();
      const wishlistRecord = await WishlistRecord.findOne({ userEmail: u.email }).lean();
      return {
        ...u,
        cart: cartRecord ? cartRecord.cartItems : [],
        wishlist: wishlistRecord ? wishlistRecord.wishlistItems : []
      };
    }));
    
    return res.status(200).json(customers);
  } catch (error) {
    console.error("Fetch Customers Error:", error);
    return res.status(500).json({ message: 'Failed to fetch customers: ' + error.message });
  }
});

// =========================================================================
// 🟢 2. ADMIN USERS MANAGEMENT (STRICTLY 'adminusers' COLLECTION)
// =========================================================================

// A. Register / Add Admin User (Saves directly into 'adminusers' table)
app.post(['/api/auth/admin-users', '/api/admin/auth/signup', '/api/admin/auth/register'], async (req, res) => {
  try {
    const { name, email, password, mobile, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, Email & Password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await AdminUser.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: 'Admin/Staff with this email already exists!' });
    }

    const newAdmin = new AdminUser({
      name,
      email: cleanEmail,
      password,
      role: role || 'Admin',
      mobile: mobile || ''
    });
    await newAdmin.save();

    const token = jwt.sign(
      { id: newAdmin._id, role: newAdmin.role },
      process.env.JWT_SECRET || 'techstore_secret_jwt_key_2026',
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      message: 'Admin/Staff user registered in adminusers table!',
      token,
      admin: { id: newAdmin._id, name: newAdmin.name, email: newAdmin.email, role: newAdmin.role, mobile: newAdmin.mobile }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to register admin: ' + err.message });
  }
});

// B. Fetch All Admin Users (Reads strictly from 'adminusers' table)
app.get(['/api/auth/admin-users', '/api/admin/users'], async (req, res) => {
  try {
    const adminUsers = await AdminUser.find({}, 'name email role mobile createdAt').sort({ createdAt: -1 });
    return res.status(200).json(adminUsers);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch admin users: ' + err.message });
  }
});

// C. Delete Admin User
app.delete('/api/auth/admin-users/:id', async (req, res) => {
  try {
    await AdminUser.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'Admin user deleted successfully from adminusers table.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete admin user: ' + err.message });
  }
});

// =========================================================================
// 🟢 3. PRODUCTS & BULK UPLOAD APIS
// =========================================================================

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    return res.status(200).json(products);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch products' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, price, category, description, image, countInStock, stock, rating } = req.body;
    const newProd = new Product({
      name,
      price: Number(price) || 0,
      category: category || 'General',
      description: description || '',
      image: image || '',
      countInStock: Number(stock) || Number(countInStock) || 10,
      rating: Number(rating) || 4.5
    });
    await newProd.save();
    return res.status(201).json(newProd);
  } catch (err) {
    return res.status(500).json({ message: 'Product add error: ' + err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Product update failed' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'Product deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Product delete error' });
  }
});

// Bulk Upload (JSON & CSV Support)
app.post('/api/products/bulk-upload', upload.any(), async (req, res) => {
  try {
    let productsToInsert = [];
    if (req.body && req.body.products) {
      productsToInsert = typeof req.body.products === 'string' ? JSON.parse(req.body.products) : req.body.products;
    } else if (req.files && req.files.length > 0) {
      const csvData = req.files[0].buffer.toString('utf8');
      const lines = csvData.split(/\r?\n/);
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/(^"|"$)/g, '').trim());
          const item = {};
          headers.forEach((h, idx) => { item[h] = values[idx]; });
          productsToInsert.push(item);
        }
      }
    }

    let count = 0;
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
        count++;
      }
    }
    const all = await Product.find({}).sort({ createdAt: -1 });
    return res.status(201).json({ message: `Successfully uploaded ${count} products!`, products: all });
  } catch (err) {
    return res.status(500).json({ message: 'Bulk upload error: ' + err.message });
  }
});

// Image Uploads
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    return res.status(200).json({ imageUrl: base64Image });
  } catch (error) {
    return res.status(500).json({ message: 'Upload error: ' + error.message });
  }
});

app.post('/api/products/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    return res.status(200).json({ imageUrl: base64Image });
  } catch (error) {
    return res.status(500).json({ message: 'Upload error: ' + error.message });
  }
});

// =========================================================================
// 🟢 4. ORDERS APIS
// =========================================================================

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    const saved = await newOrder.save();
    return res.status(201).json({ message: 'Order placed successfully', order: saved });
  } catch (err) {
    return res.status(500).json({ message: 'Order placement failed: ' + err.message });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const updated = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Status update failed' });
  }
});

app.put('/api/orders/:id/return', async (req, res) => {
  try {
    const { returnType, reason, comments } = req.body;
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { status: `Return Requested (${returnType}): ${reason} - ${comments || ''}` },
      { new: true }
    );
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Return request error' });
  }
});

// =========================================================================
// 🟢 5. BANNERS, REVIEWS & COUPONS APIS
// =========================================================================

// Banners
app.get('/api/banners', async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ createdAt: -1 });
    return res.status(200).json(banners);
  } catch (err) {
    return res.status(500).json({ message: 'Fetch banners failed' });
  }
});

app.post('/api/banners', async (req, res) => {
  try {
    const banner = new Banner(req.body);
    await banner.save();
    const all = await Banner.find({}).sort({ createdAt: -1 });
    return res.status(201).json({ message: 'Banner saved', banners: all });
  } catch (err) {
    return res.status(500).json({ message: 'Banner save failed' });
  }
});

app.delete('/api/banners/:id', async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    const all = await Banner.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Banner deleted', banners: all });
  } catch (err) {
    return res.status(500).json({ message: 'Banner delete error' });
  }
});

// Reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({}).sort({ createdAt: -1 });
    return res.status(200).json(reviews);
  } catch (err) {
    return res.status(500).json({ message: 'Reviews fetch failed' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const review = new Review(req.body);
    const saved = await review.save();
    return res.status(201).json({ message: 'Review saved', review: saved });
  } catch (err) {
    return res.status(500).json({ message: 'Review save failed' });
  }
});

// Coupons
app.get('/api/coupons', async (req, res) => {
  try {
    const { email } = req.query;
    let query = {};
    if (email) {
      const clean = email.toLowerCase().trim();
      query = { $or: [{ targetUserEmail: { $exists: false } }, { targetUserEmail: '' }, { targetUserEmail: clean }] };
    }
    const coupons = await Coupon.find(query).sort({ createdAt: -1 });
    return res.status(200).json(coupons);
  } catch (err) {
    return res.status(500).json({ message: 'Coupons fetch failed' });
  }
});

app.post('/api/coupons', async (req, res) => {
  try {
    const { code, discount, category, maxUsage, targetUserEmail } = req.body;
    const formattedCode = (code || '').toUpperCase().trim();
    const existing = await Coupon.findOne({ code: formattedCode });
    if (existing) return res.status(400).json({ message: 'Coupon already exists!' });

    const newCoupon = new Coupon({
      code: formattedCode,
      discount: Number(discount) || 10,
      category: category || 'All',
      maxUsage: Number(maxUsage) || 100,
      targetUserEmail: targetUserEmail ? targetUserEmail.toLowerCase().trim() : ''
    });
    await newCoupon.save();
    const all = await Coupon.find({}).sort({ createdAt: -1 });
    return res.status(201).json({ message: 'Coupon created', coupons: all });
  } catch (err) {
    return res.status(500).json({ message: 'Coupon creation error' });
  }
});

app.post('/api/coupons/use', async (req, res) => {
  try {
    const { code } = req.body;
    const formattedCode = (code || '').toUpperCase().trim();
    const coupon = await Coupon.findOne({ code: formattedCode });
    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save();
      return res.status(200).json({ message: 'Coupon used', coupon });
    }
    return res.status(404).json({ message: 'Coupon not found' });
  } catch (err) {
    return res.status(500).json({ message: 'Coupon error' });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    const all = await Coupon.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Coupon deleted', coupons: all });
  } catch (err) {
    return res.status(500).json({ message: 'Coupon delete failed' });
  }
});

// Root Healthcheck
app.get('/', (req, res) => {
  res.send('🚀 TechStore Single Central Backend is Active & Live for Customer & Admin!');
});

// =========================================================================
// 🚀 SERVER START & DATABASE CONNECTION
// =========================================================================
const startServer = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI missing in .env');
    } else {
      await mongoose.connect(mongoUri);
      console.log('✅ Real MongoDB Atlas Database Connected Successfully!');
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running smoothly on port ${PORT}`);
    });
  } catch (err) {
    console.error('Database connection error:', err.message);
  }
};

startServer();