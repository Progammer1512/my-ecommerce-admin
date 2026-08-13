const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// 🟢 STRICT SCHEMA BOUND DIRECTLY TO 'adminusers' COLLECTION
const adminUserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, default: 'Admin' },
  mobile: { type: String, default: '' }
}, { timestamps: true });

// Forcefully bind to 'adminusers' collection in MongoDB Atlas
const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema, 'adminusers');

// 1. SIGNUP ROUTE (Guaranteed to save ONLY in adminusers collection)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, secretCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const ADMIN_SECRET_KEY = process.env.ADMIN_SIGNUP_SECRET || 'iamthebest~$@%^&15121';
    if (secretCode && secretCode.trim() !== ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: 'Access Denied: Invalid Admin Secret Code!' });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Check in adminusers collection exclusively
    const existingUser = await AdminUser.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Admin user already exists with this email!' });
    }

    let assignedRole = role ? role.trim() : 'Staff';
    if (assignedRole.toLowerCase() === 'inventorymanager') assignedRole = 'InventoryManager';
    else if (assignedRole.toLowerCase() === 'staff') assignedRole = 'Staff';
    else if (assignedRole.toLowerCase() === 'superadmin') assignedRole = 'SuperAdmin';
    else assignedRole = 'Admin';

    // Save exclusively to adminusers collection
    const newUser = new AdminUser({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(), 
      role: assignedRole
    });

    await newUser.save();

    console.log(`✅ SUCCESS: Admin saved strictly to 'adminusers' collection -> ${cleanEmail}`);

    return res.status(201).json({ 
      message: 'Admin/Staff registered successfully!', 
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({ message: 'Signup error: ' + error.message });
  }
});

// 2. LOGIN ROUTE (Fetches ONLY from adminusers collection)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Find strictly in adminusers collection
    const user = await AdminUser.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.password !== cleanPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const finalRole = user.role || 'SuperAdmin';

    const token = jwt.sign(
      { id: user._id, role: finalRole }, 
      process.env.JWT_SECRET || 'supersecretkey123', 
      { expiresIn: '30d' }
    );

    console.log(`🔓 SUCCESS: Admin logged in from 'adminusers' collection -> ${cleanEmail}`);

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: finalRole,
      token
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: 'Login error: ' + error.message });
  }
});

module.exports = router;