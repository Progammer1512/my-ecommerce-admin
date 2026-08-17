const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ==========================================
// 🗄️ SAFE MODEL RESOLVER
// ==========================================
const resolveModel = (imported, fallbackName, schemaDef, collectionName) => {
  if (imported && typeof imported.find === 'function') return imported;
  if (imported && imported[fallbackName] && typeof imported[fallbackName].find === 'function') return imported[fallbackName];
  if (mongoose.models[fallbackName]) return mongoose.models[fallbackName];
  const schema = new mongoose.Schema(schemaDef, { collection: collectionName || undefined, timestamps: true });
  return mongoose.model(fallbackName, schema);
};

// 1. Customer User Model
let rawUser; try { rawUser = require('./models/User'); } catch (e) {}
const User = resolveModel(rawUser, 'User', {
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, default: 'google_authenticated_user' },
  mobile: { type: String, default: '' },
  address: { type: String, default: '' },
  pincode: { type: String, default: '' },
  googleId: { type: String, default: '' },
  avatar: { type: String, default: '' },
  isVerified: { type: Boolean, default: true }
}, 'users');

// 2. Admin User Model
let rawAdmin; try { rawAdmin = require('./models/AdminUser'); } catch (e) {}
const AdminUser = resolveModel(rawAdmin, 'AdminUser', {
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, default: 'Admin' },
  mobile: { type: String, default: '' }
}, 'adminusers');

// 3. Orders Model
let rawOrder; 
try { rawOrder = require('./models/Order'); } catch (e) {
  try { rawOrder = require('./models/orderModel'); } catch (err) {}
}
const Order = resolveModel(rawOrder, 'Order', {
  userEmail: { type: String, lowercase: true, trim: true },
  orderItems: Array,
  shippingAddress: Object,
  paymentMethod: { type: String, default: 'Cash on Delivery (COD)' },
  totalPrice: { type: Number, required: true },
  status: { type: String, default: 'Processing' }
}, 'orders');

// 4. 🟢 INFINITE NESTED CATEGORY MODEL (Self-Referencing Tree)
let rawCategory; try { rawCategory = require('./models/Category'); } catch (e) {}
const Category = resolveModel(rawCategory, 'Category', {
  name: { type: String, required: true, trim: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  slug: { type: String, default: '' }
}, 'categories');

// 5. 🟢 FULLY DYNAMIC PRODUCT MODEL (WITH VARIANT-LEVEL MULTI-IMAGE GALLERY & VIDEO)
let rawProd; try { rawProd = require('./models/Product'); } catch (e) {}
const Product = resolveModel(rawProd, 'Product', {
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  category: { type: String, default: 'General' },
  categoryPath: { type: [String], default: [] },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  images: { type: [String], default: [] },
  video: {
    url: { type: String, default: '' },
    videoType: { type: String, enum: ['file', 'youtube', 'none'], default: 'none' },
    thumbnail: { type: String, default: '' }
  },
  dynamicAttributeNames: { type: [String], default: [] },
  variants: {
    type: [{
      attributes: { type: Map, of: String, default: {} },
      color: { type: String, default: '' },
      size: { type: String, default: '' },
      price: { type: Number, required: true },
      stock: { type: Number, default: 0 },
      image: { type: String, default: '' },
      images: { type: [String], default: [] },
      video: {
        url: { type: String, default: '' },
        videoType: { type: String, enum: ['file', 'youtube', 'none'], default: 'none' }
      }
    }],
    default: []
  },
  countInStock: { type: Number, default: 10 },
  stock: { type: Number, default: 10 },
  rating: { type: Number, default: 4.5 },
  priority: { type: Number, default: 100 }
}, 'products');

// 6. Tracking & Auxiliary Models
let rawCart; try { rawCart = require('./models/AbandonedCart'); } catch (e) {}
const AbandonedCart = resolveModel(rawCart, 'AbandonedCart', {
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  userName: { type: String, default: '' },
  mobile: { type: String, default: '' },
  cartItems: { type: Array, default: [] }
}, 'abandonedcarts');

let rawWish; try { rawWish = require('./models/Wishlist'); } catch (e) {}
const WishlistRecord = resolveModel(rawWish, 'WishlistRecord', {
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  userName: { type: String, default: '' },
  mobile: { type: String, default: '' },
  wishlistItems: { type: Array, default: [] }
}, 'wishlistrecords');

let rawBanner; try { rawBanner = require('./models/bannerModel'); } catch (e) {}
const Banner = resolveModel(rawBanner, 'Banner', {
  title: String,
  subtitle: String,
  badge: String,
  img: String,
  bg: String,
  priority: { type: Number, default: 100 }
}, 'banners');

let rawReview; try { rawReview = require('./models/reviewModel'); } catch (e) {}
const Review = resolveModel(rawReview, 'Review', { orderId: String, customerName: String, customerEmail: String, rating: Number, comment: String, items: Array, date: String }, 'reviews');

let rawCoupon; try { rawCoupon = require('./models/couponModel'); } catch (e) {}
const Coupon = resolveModel(rawCoupon, 'Coupon', { code: { type: String, required: true, unique: true }, discount: Number, category: String, maxUsage: Number, usedCount: { type: Number, default: 0 }, targetUserEmail: { type: String, default: '' } }, 'coupons');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet({ crossOriginResourcePolicy: false }));

// 📂 SERVE STATIC UPLOADS FOLDER (IMAGES & VIDEOS)
app.use('/uploads', express.static(uploadsDir));

// Multer memory storage for quick base64 / CSV
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// Disk storage for large MP4 / video files
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadDiskVideo = multer({
  storage: diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Use upload routes module if present
try {
  const uploadRoutes = require('./routes/uploadRoutes');
  app.use('/api/upload', uploadRoutes);
} catch (e) {
  console.log('Using inline upload handler in server.js');
}

// =========================================================================
// 🟢 HELPER: READS EXACT STOCK FROM PRODUCT
// =========================================================================
const getProductStock = (p) => {
  if (!p) return 0;
  if (p.countInStock !== undefined && p.countInStock !== null) return Number(p.countInStock);
  if (p.stock !== undefined && p.stock !== null) return Number(p.stock);
  return 0;
};

// =========================================================================
// 🟢 1. CUSTOMER AUTH & SYNC ROUTES
// =========================================================================

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
    return res.status(500).json({ message: 'Auth error: ' + error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, mobile, address, pincode } = req.body;
    if (!email || !name) return res.status(400).json({ message: 'Name and Email are required' });

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) return res.status(400).json({ message: 'Account already exists with this email!' });

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

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const cleanEmail = email.toLowerCase().trim();

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

// Real-time Wishlist & Cart Endpoints
app.get(['/api/auth/wishlist', '/api/wishlist'], async (req, res) => {
  try {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(200).json({ wishlist: [] });
    const record = await WishlistRecord.findOne({ userEmail: email }).lean();
    return res.status(200).json({ wishlist: record ? record.wishlistItems : [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

app.post(['/api/auth/wishlist', '/api/wishlist'], async (req, res) => {
  try {
    const { email, wishlist, name, mobile } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const cleanEmail = email.toLowerCase().trim();

    await WishlistRecord.findOneAndUpdate(
      { userEmail: cleanEmail },
      { $set: { userName: name || '', mobile: mobile || '', wishlistItems: wishlist || [] } },
      { upsert: true, new: true }
    );
    return res.status(200).json({ message: 'Wishlist synced successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to save wishlist: ' + err.message });
  }
});

app.get(['/api/auth/cart', '/api/cart'], async (req, res) => {
  try {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(200).json({ cart: [] });
    const record = await AbandonedCart.findOne({ userEmail: email }).lean();
    return res.status(200).json({ cart: record ? record.cartItems : [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

app.post(['/api/auth/cart', '/api/cart'], async (req, res) => {
  try {
    const { email, cart, name, mobile } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const cleanEmail = email.toLowerCase().trim();

    await AbandonedCart.findOneAndUpdate(
      { userEmail: cleanEmail },
      { $set: { userName: name || '', mobile: mobile || '', cartItems: cart || [] } },
      { upsert: true, new: true }
    );
    return res.status(200).json({ message: 'Cart synced successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to save cart: ' + err.message });
  }
});

app.put('/api/auth/profile', async (req, res) => {
  try {
    const { email, name, mobile, address, pincode, cart, wishlist } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

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

app.delete('/api/auth/profile', async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();
    await User.findOneAndDelete({ email: cleanEmail });
    await AbandonedCart.findOneAndDelete({ userEmail: cleanEmail });
    await WishlistRecord.findOneAndDelete({ userEmail: cleanEmail });
    return res.status(200).json({ message: 'Customer account permanently deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Delete failed: ' + error.message });
  }
});

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
    return res.status(500).json({ message: 'Failed to fetch customers: ' + error.message });
  }
});

// =========================================================================
// 🟢 2. INFINITE NESTED CATEGORIES ENGINE
// =========================================================================

const buildCategoryTree = (categories, parentId = null) => {
  const branch = [];
  const matches = parentId === null
    ? categories.filter(c => !c.parent)
    : categories.filter(c => c.parent && c.parent.toString() === parentId.toString());

  for (let cat of matches) {
    branch.push({
      _id: cat._id,
      name: cat.name,
      parent: cat.parent,
      children: buildCategoryTree(categories, cat._id)
    });
  }
  return branch;
};

app.get('/api/categories', async (req, res) => {
  try {
    const allCategories = await Category.find({}).lean();
    const tree = buildCategoryTree(allCategories);
    return res.status(200).json({ categories: allCategories, tree });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch categories: ' + err.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Category name is required' });

    const newCat = new Category({
      name: name.trim(),
      parent: parentId || null
    });
    await newCat.save();

    const allCategories = await Category.find({}).lean();
    const tree = buildCategoryTree(allCategories);
    return res.status(201).json({ message: 'Category created successfully!', category: newCat, tree });
  } catch (err) {
    return res.status(500).json({ message: 'Category creation error: ' + err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    const deleteSubTree = async (pId) => {
      const children = await Category.find({ parent: pId });
      for (let child of children) {
        await deleteSubTree(child._id);
        await Category.findByIdAndDelete(child._id);
      }
    };
    await deleteSubTree(targetId);
    await Category.findByIdAndDelete(targetId);

    const allCategories = await Category.find({}).lean();
    const tree = buildCategoryTree(allCategories);
    return res.status(200).json({ message: 'Category and all sub-branches deleted.', tree });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete category: ' + err.message });
  }
});

// =========================================================================
// 🟢 3. ADMIN USERS MANAGEMENT ('adminusers' COLLECTION)
// =========================================================================

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

app.get(['/api/auth/admin-users', '/api/admin/users'], async (req, res) => {
  try {
    const adminUsers = await AdminUser.find({}, 'name email role mobile createdAt').sort({ createdAt: -1 });
    return res.status(200).json(adminUsers);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch admin users: ' + err.message });
  }
});

app.delete('/api/auth/admin-users/:id', async (req, res) => {
  try {
    await AdminUser.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'Admin user deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete admin user: ' + err.message });
  }
});

// =========================================================================
// 🟢 4. PRODUCTS MANAGEMENT (WITH DEDICATED VARIANT MULTI-IMAGE & VIDEO SUPPORT)
// =========================================================================

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ priority: 1, createdAt: -1 });
    return res.status(200).json(products);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch products' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, price, category, categoryPath, description, image, images, video, dynamicAttributeNames, variants, countInStock, stock, rating, priority } = req.body;
    
    let galleryImages = [];
    if (Array.isArray(images) && images.length > 0) {
      galleryImages = images.filter(Boolean);
    } else if (image) {
      galleryImages = [image];
    }

    const coverImage = (galleryImages.length > 0) ? galleryImages[0] : (image || '');

    // 🟢 Parse Variants with dedicated images array & cover image
    let parsedVariants = [];
    if (Array.isArray(variants)) {
      parsedVariants = variants.map(v => {
        let varImgs = [];
        if (Array.isArray(v.images) && v.images.length > 0) {
          varImgs = v.images.filter(Boolean);
        } else if (v.image) {
          varImgs = [v.image];
        }

        return {
          attributes: v.attributes || {},
          color: v.color || '',
          size: v.size || '',
          price: Number(v.price) || Number(price) || 0,
          stock: Number(v.stock) || 0,
          image: varImgs.length > 0 ? varImgs[0] : (v.image || ''),
          images: varImgs,
          video: v.video || { url: '', videoType: 'none' }
        };
      });
    }

    const newProd = new Product({
      name,
      price: Number(price) || 0,
      category: category || 'General',
      categoryPath: Array.isArray(categoryPath) && categoryPath.length > 0 ? categoryPath : [category || 'General'],
      description: description || '',
      image: coverImage,
      images: galleryImages,
      video: video || { url: '', videoType: 'none', thumbnail: '' },
      dynamicAttributeNames: Array.isArray(dynamicAttributeNames) ? dynamicAttributeNames : [],
      variants: parsedVariants,
      countInStock: Number(stock) || Number(countInStock) || 10,
      stock: Number(stock) || Number(countInStock) || 10,
      rating: Number(rating) || 4.5,
      priority: priority !== undefined && priority !== '' ? Number(priority) : 100
    });
    await newProd.save();
    return res.status(201).json(newProd);
  } catch (err) {
    return res.status(500).json({ message: 'Product add error: ' + err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.priority !== undefined && updateData.priority !== null && updateData.priority !== '') {
      updateData.priority = Number(updateData.priority);
    }
    if (updateData.price !== undefined) {
      updateData.price = Number(updateData.price);
    }
    if (updateData.stock !== undefined || updateData.countInStock !== undefined) {
      const s = Number(updateData.stock !== undefined ? updateData.stock : updateData.countInStock) || 0;
      updateData.stock = s;
      updateData.countInStock = s;
    }

    if (updateData.images && Array.isArray(updateData.images)) {
      updateData.images = updateData.images.filter(Boolean);
      if (updateData.images.length > 0 && !updateData.image) {
        updateData.image = updateData.images[0];
      }
    } else if (updateData.image && (!updateData.images || updateData.images.length === 0)) {
      updateData.images = [updateData.image];
    }

    if (updateData.video) {
      updateData.video = {
        url: updateData.video.url || '',
        videoType: updateData.video.videoType || 'none',
        thumbnail: updateData.video.thumbnail || ''
      };
    }

    // 🟢 Parse Variants with dedicated images array on update
    if (updateData.variants && Array.isArray(updateData.variants)) {
      updateData.variants = updateData.variants.map(v => {
        let varImgs = [];
        if (Array.isArray(v.images) && v.images.length > 0) {
          varImgs = v.images.filter(Boolean);
        } else if (v.image) {
          varImgs = [v.image];
        }

        return {
          attributes: v.attributes || {},
          color: v.color || '',
          size: v.size || '',
          price: Number(v.price) || Number(updateData.price) || 0,
          stock: Number(v.stock) || 0,
          image: varImgs.length > 0 ? varImgs[0] : (v.image || ''),
          images: varImgs,
          video: v.video || { url: '', videoType: 'none' }
        };
      });
    }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Product not found in database' });
    }

    return res.status(200).json(updated);
  } catch (err) {
    console.error('Product update error:', err.message);
    return res.status(500).json({ message: 'Product update failed: ' + err.message });
  }
});

app.put('/api/products/:id/priority', async (req, res) => {
  try {
    const priorityVal = Number(req.body.priority);
    if (isNaN(priorityVal)) return res.status(400).json({ message: 'Invalid priority number' });

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { priority: priorityVal } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update priority: ' + err.message });
  }
});

app.put('/api/products/priority/batch', async (req, res) => {
  try {
    const { priorities } = req.body;
    if (Array.isArray(priorities)) {
      for (const item of priorities) {
        if (item.id) {
          await Product.findByIdAndUpdate(item.id, { $set: { priority: Number(item.priority) || 100 } });
        }
      }
    }
    const all = await Product.find({}).sort({ priority: 1, createdAt: -1 });
    return res.status(200).json({ message: 'Product priorities updated successfully!', products: all });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update priorities: ' + err.message });
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

app.post('/api/products/bulk-upload', uploadMemory.any(), async (req, res) => {
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
        const primaryImg = item.image || item.imageUrl || '';
        const galleryImgs = item.images ? (Array.isArray(item.images) ? item.images : String(item.images).split('|')) : [primaryImg];

        await Product.create({
          name: item.name || item.title,
          price: Number(item.price) || 0,
          category: item.category || 'General',
          categoryPath: item.categoryPath || [item.category || 'General'],
          description: item.description || '',
          image: primaryImg,
          images: galleryImgs.filter(Boolean),
          video: {
            url: item.video || item.videourl || '',
            videoType: (item.video || item.videourl || '').includes('youtu') ? 'youtube' : ((item.video || item.videourl) ? 'file' : 'none'),
            thumbnail: ''
          },
          dynamicAttributeNames: item.dynamicAttributeNames || [],
          variants: item.variants ? (typeof item.variants === 'string' ? JSON.parse(item.variants) : item.variants) : [],
          countInStock: Number(item.stock) || Number(item.countInStock) || 10,
          stock: Number(item.stock) || Number(item.countInStock) || 10,
          rating: Number(item.rating) || 4.5,
          priority: item.priority !== undefined ? Number(item.priority) : 100
        });
        count++;
      }
    }
    const all = await Product.find({}).sort({ priority: 1, createdAt: -1 });
    return res.status(201).json({ message: `Successfully uploaded ${count} products!`, products: all });
  } catch (err) {
    return res.status(500).json({ message: 'Bulk upload error: ' + err.message });
  }
});

// 📸 Image Single Upload Endpoints
app.post(['/api/upload', '/api/products/upload'], uploadMemory.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    return res.status(200).json({ imageUrl: base64Image });
  } catch (error) {
    return res.status(500).json({ message: 'Upload error: ' + error.message });
  }
});

// 🎥 🟢 DIRECT VIDEO UPLOAD ENDPOINT (Fixes 404 on /api/upload/video)
app.post('/api/upload/video', uploadDiskVideo.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please select a valid video file to upload' });
    }
    const cleanPath = `/uploads/${req.file.filename}`;
    return res.status(200).json({
      message: 'Video uploaded successfully!',
      videoUrl: cleanPath
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return res.status(500).json({ message: 'Video upload failed: ' + error.message });
  }
});

// =========================================================================
// 🟢 5. BANNERS, ORDERS, REVIEWS & COUPONS
// =========================================================================

app.get('/api/banners', async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ priority: 1, createdAt: -1 });
    return res.status(200).json(banners);
  } catch (err) {
    return res.status(500).json({ message: 'Fetch banners failed' });
  }
});

app.post('/api/banners', async (req, res) => {
  try {
    const { title, subtitle, badge, img, bg, priority } = req.body;
    const banner = new Banner({
      title: title || '',
      subtitle: subtitle || '',
      badge: badge || '',
      img: img || '',
      bg: bg || '',
      priority: priority !== undefined && priority !== '' ? Number(priority) : 100
    });
    await banner.save();
    const all = await Banner.find({}).sort({ priority: 1, createdAt: -1 });
    return res.status(201).json({ message: 'Banner saved', banners: all });
  } catch (err) {
    return res.status(500).json({ message: 'Banner save failed' });
  }
});

app.put('/api/banners/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.priority !== undefined && updateData.priority !== null && updateData.priority !== '') {
      updateData.priority = Number(updateData.priority);
    }
    await Banner.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
    const all = await Banner.find({}).sort({ priority: 1, createdAt: -1 });
    return res.status(200).json({ message: 'Banner updated', banners: all });
  } catch (err) {
    return res.status(500).json({ message: 'Banner update failed' });
  }
});

app.delete('/api/banners/:id', async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    const all = await Banner.find({}).sort({ priority: 1, createdAt: -1 });
    return res.status(200).json({ message: 'Banner deleted', banners: all });
  } catch (err) {
    return res.status(500).json({ message: 'Banner delete error' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch orders: ' + err.message });
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

// =========================================================================
// 🟢 6. STORE AI ASSISTANT ENDPOINT (FULL E-COMMERCE KNOWLEDGE & ORDERS)
// =========================================================================
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, userEmail, currentProductName } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ reply: "Please ask me about any product or order!" });
    }

    const query = message.trim();
    const lowerQuery = query.toLowerCase();

    // 🟢 1. Check for Greetings
    const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good evening', 'good afternoon', 'sup', 'hola'];
    if (greetings.includes(lowerQuery) || lowerQuery.startsWith('hi ') || lowerQuery.startsWith('hello ')) {
      return res.status(200).json({ 
        reply: "Hello! 👋 Welcome to TechStore. How can I help you today? You can ask me about products, stock, variants, or check your placed orders and returns!" 
      });
    }

    // 🟢 2. Check for Appreciation / Thanks
    const thanksWords = ['thank you', 'thanks', 'thx', 'thank u', 'ok', 'okay', 'great', 'nice', 'bye', 'goodbye', 'dost', 'bhai'];
    if (thanksWords.some(word => lowerQuery === word || lowerQuery.includes(word))) {
      return res.status(200).json({ 
        reply: "You're very welcome! 😊 Feel free to ask if you need help with any other product or order." 
      });
    }

    // 🟢 3. Check for Orders / Tracking / Returns / Refunds
    const orderKeywords = ['order', 'track', 'shipping', 'delivery', 'refund', 'return', 'replacement', 'status', 'history'];
    if (orderKeywords.some(keyword => lowerQuery.includes(keyword))) {
      if (!userEmail) {
        return res.status(200).json({ 
          reply: "To check your orders, tracking, or returns, please sign in to your account first so I can fetch your order records!" 
        });
      }

      const userOrders = await Order.find({ userEmail: userEmail.toLowerCase().trim() }).sort({ createdAt: -1 }).limit(3).lean();
      if (!userOrders || userOrders.length === 0) {
        return res.status(200).json({ reply: `I couldn't find any recent orders associated with your email (${userEmail}).` });
      }

      let orderReply = `📦 **Your Recent Orders & Status:**\n\n`;
      userOrders.forEach((o) => {
        orderReply += `• **Order ID:** #${o._id}\n`;
        orderReply += `  Status: **${o.status || 'Processing'}**\n`;
        orderReply += `  Total: ₹${o.totalPrice} (${o.paymentMethod || 'COD'})\n`;
        if (o.orderItems && o.orderItems.length > 0) {
          orderReply += `  Items: ${o.orderItems.map(i => `${i.name} (Qty: ${i.qty})`).join(', ')}\n`;
        }
        orderReply += `\n`;
      });
      return res.status(200).json({ reply: orderReply.trim() });
    }

    // 🟢 4. Context Query
    const contextWords = ['price', 'stock', 'variant', 'variants', 'color', 'size', 'detail', 'details', 'cost', 'rate', 'specs', 'kitna', 'bhav', 'rupaye'];
    let searchFilter = {};
    if (currentProductName && (contextWords.some(w => lowerQuery.includes(w)) || lowerQuery.length <= 6)) {
      searchFilter = { name: currentProductName };
    } else {
      searchFilter = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { category: { $regex: query, $options: 'i' } }
        ]
      };
    }

    const matchedProducts = await Product.find(searchFilter).limit(2).lean();

    if (matchedProducts.length === 0) {
      return res.status(200).json({ 
        reply: `I couldn't find any products matching "${query}". Try searching for specific item names or categories like Electronics or Fashion!` 
      });
    }

    let responseText = "";
    matchedProducts.forEach((p) => {
      responseText += `📦 **${p.name}**\n`;
      responseText += `💰 Price: ₹${p.price}\n`;
      responseText += `📂 Category: ${p.category || 'General'}\n`;
      responseText += `📝 Description: ${p.description || 'No description provided.'}\n`;
      
      const totalStock = getProductStock(p);
      responseText += `📊 Total Stock Available: ${totalStock}\n`;

      if (p.variants && p.variants.length > 0) {
        responseText += `✨ **Available Options & Variants:**\n`;
        p.variants.forEach((v) => {
          const rawAttrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : (v.attributes || {});
          const attrStr = Object.entries(rawAttrs).map(([k, val]) => `${k}: ${val}`).join(', ');
          const optionLabel = attrStr || (v.size ? `Size: ${v.size}` : '') || (v.color ? `Color: ${v.color}` : `Variant`);
          responseText += `  • [${optionLabel}] - ₹${v.price} (Stock: ${v.stock})\n`;
        });
      }
      responseText += `\n`;
    });

    return res.status(200).json({ reply: responseText.trim() });
  } catch (err) {
    console.error("AI Chat Error:", err.message);
    return res.status(500).json({ reply: "Sorry, I encountered an error while processing your request. Please try again." });
  }
});

app.get('/', (req, res) => {
  res.send('🚀 TechStore Universal Central Backend Active with AI Assistant & Infinite Nested Categories!');
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