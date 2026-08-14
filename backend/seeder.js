const mongoose = require('mongoose');
const User = require('./models/AdminUser');
const connectDB = require('./config/db');
require('dotenv').config();

connectDB();

const importUsers = async () => {
  try {
    await User.deleteMany();

    // Direct object creation
    await User.create([
      {
        name: 'Super Admin',
        email: 'admin@techstore.com',
        password: 'adminpassword123',
        role: 'SuperAdmin',
      },
      {
        name: 'Inventory Manager',
        email: 'inventory@techstore.com',
        password: 'staffpassword123',
        role: 'InventoryManager',
      },
      {
        name: 'Support Staff',
        email: 'staff@techstore.com',
        password: 'staffpassword123',
        role: 'Staff',
      }
    ]);

    console.log('🎉 DB Reset Complete & Demo Users Inserted!');
    process.exit();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

importUsers();