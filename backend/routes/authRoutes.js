const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // User model import kar liya

// 1. SIGNUP ROUTE (Database mein naya admin/staff register karne ke liye)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email!' });
    }

    // Determine role and sanitize it properly to match User schema enum
    let assignedRole = role ? role.trim() : 'Staff';
    
    // Fallback normalization just in case
    if (assignedRole.toLowerCase() === 'inventorymanager') assignedRole = 'InventoryManager';
    else if (assignedRole.toLowerCase() === 'staff') assignedRole = 'Staff';
    else if (assignedRole.toLowerCase() === 'superadmin') assignedRole = 'SuperAdmin';

    // Create new user with selected role
    const newUser = new User({
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

// 2. LOGIN ROUTE (MongoDB Database se verify karne ke liye)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Find user in MongoDB database
    const user = await User.findOne({ email: cleanEmail });
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