const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
// 🟢 IMPORT AdminUser MODEL INSTEAD OF User
const { AdminUser } = require('../models/User'); 

// 1. SIGNUP ROUTE (Database mein naya admin/staff register karne ke liye - Secured with Secret Code)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, secretCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // 🔒 SECURITY CHECK: Secret Password Verify karna zaroori hai
    const ADMIN_SECRET_KEY = process.env.ADMIN_SIGNUP_SECRET || 'iamthebest~$@%^&15121';
    if (!secretCode || secretCode.trim() !== ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: 'Access Denied: Invalid or missing Admin Secret Code!' });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Check if admin user already exists in AdminUser collection
    const existingUser = await AdminUser.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Admin user already exists with this email!' });
    }

    // Determine role and sanitize it properly
    let assignedRole = role ? role.trim() : 'Staff';
    
    if (assignedRole.toLowerCase() === 'inventorymanager') assignedRole = 'InventoryManager';
    else if (assignedRole.toLowerCase() === 'staff') assignedRole = 'Staff';
    else if (assignedRole.toLowerCase() === 'superadmin') assignedRole = 'SuperAdmin';
    else assignedRole = 'Admin';

    // 🟢 SAVE NEW ADMIN TO AdminUser COLLECTION (Dedicated Admin Table)
    const newUser = new AdminUser({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(), 
      role: assignedRole
    });

    await newUser.save();

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
    return res.status(500).json({ message: 'Signup error: ' + error.message });
  }
});

// 2. LOGIN ROUTE (Verify from AdminUser collection)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 🟢 FIND USER IN AdminUser COLLECTION
    const user = await AdminUser.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    if (user.password !== cleanPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Ensure role is never null or undefined
    const finalRole = user.role || 'SuperAdmin';

    // Generate JWT Token with actual database user id and role
    const token = jwt.sign(
      { id: user._id, role: finalRole }, 
      process.env.JWT_SECRET || 'supersecretkey123', 
      { expiresIn: '30d' }
    );

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: finalRole,
      token
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login error: ' + error.message });
  }
});

module.exports = router;