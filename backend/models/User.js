const mongoose = require('mongoose');

// 1. CUSTOMER SCHEMA (Shoppers wali website ke users ke liye)
const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'] 
  },
  role: { 
    type: String, 
    enum: ['Customer', 'customer'], 
    default: 'Customer' 
  }
}, { timestamps: true });

// 2. ADMIN USER SCHEMA (Admin portal ke admins, managers & staff ke liye -> adminusers collection)
const adminUserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'] 
  },
  role: { 
    type: String, 
    enum: [
      'SuperAdmin', 'Staff', 'InventoryManager', 'Manager', 'Admin',
      'superadmin', 'staff', 'inventorymanager', 'manager', 'admin'
    ], 
    default: 'Admin' 
  },
  mobile: { 
    type: String, 
    default: '' 
  }
}, { timestamps: true });

// Export both models correctly
const User = mongoose.model('User', userSchema);
const AdminUser = mongoose.model('AdminUser', adminUserSchema);

module.exports = { User, AdminUser };