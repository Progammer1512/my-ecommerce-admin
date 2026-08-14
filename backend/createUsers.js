const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/AdminUser'); 
const connectDB = require('./config/db');

connectDB();

const seedUsers = async () => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    const users = [
      {
        name: 'Super Admin User',
        email: 'admin@test.com',
        password: hashedPassword,
        role: 'SuperAdmin'
      },
      {
        name: 'Inventory Manager',
        email: 'manager@test.com',
        password: hashedPassword,
        role: 'InventoryManager'
      },
      {
        name: 'Store Staff',
        email: 'staff@test.com',
        password: hashedPassword,
        role: 'Staff'
      }
    ];

    await User.deleteMany({ email: { $in: ['admin@test.com', 'manager@test.com', 'staff@test.com'] } });
    await User.insertMany(users);

    console.log('✅ Default Test Users Created Successfully in MongoDB!');
    process.exit();
  } catch (error) {
    console.error('Error seeding users:', error.message);
    process.exit(1);
  }
};

seedUsers();