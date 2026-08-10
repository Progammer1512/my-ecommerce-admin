const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Bulletproof Login Handler for Local Testing
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Accept any of the standard test emails or admin password
  if (
    email === 'admin@techstore.com' || 
    email === 'inventory@techstore.com' || 
    email === 'staff@techstore.com' ||
    password === 'adminpassword123' ||
    password === 'staffpassword123'
  ) {
    let role = 'SuperAdmin';
    let name = 'Super Admin';

    if (email === 'inventory@techstore.com') {
      role = 'InventoryManager';
      name = 'Inventory Manager';
    } else if (email === 'staff@techstore.com') {
      role = 'Staff';
      name = 'Support Staff';
    }

    const token = jwt.sign(
      { id: '123456', role }, 
      process.env.JWT_SECRET || 'supersecretkey123', 
      { expiresIn: '30d' }
    );

    return res.json({
      _id: '123456',
      name,
      email: email || 'admin@techstore.com',
      role,
      token
    });
  }

  return res.status(401).json({ message: 'Invalid email or password' });
});

module.exports = router;