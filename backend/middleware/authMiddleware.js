const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT Token & Attach User to Request
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
      
      // Fetch user and exclude password
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User belonging to this token no longer exists' });
      }

      return next();
    } catch (error) {
      console.error('JWT Protection Error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token validation failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Role Check Guard (Case-Insensitive & Flexible)
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Access denied: No role assigned to this user' });
    }

    // Standardize role strings for clean comparison
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: `Role (${req.user.role}) is not authorized to perform this action` 
      });
    }

    next();
  };
};

module.exports = { protect, authorizeRoles };