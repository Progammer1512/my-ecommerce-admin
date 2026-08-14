const mongoose = require('mongoose');

// ADMIN USER SCHEMA (Admin portal ke admins, managers & staff ke liye -> 'adminusers' collection)
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
}, { collection: 'adminusers', timestamps: true }); // 🟢 Points strictly to 'adminusers'

// Strictly Export AdminUser Model
module.exports = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);