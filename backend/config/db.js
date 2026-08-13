const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    // 🟢 Forcefully ensure it points to the exact MongoDB Atlas database name you are viewing
    const uri = process.env.MONGO_URI || 'mongodb+srv://... (your atlas uri)';
    
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host} | Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;