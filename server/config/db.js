const mongoose = require('mongoose');
require('dotenv').config();

let cachedConnection = null;

const connectDB = async () => {
  try {
    // Already connected
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    // Reuse existing connection promise
    if (cachedConnection) {
      return cachedConnection;
    }

    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    cachedConnection = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    const conn = await cachedConnection;

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    return conn.connection;
  } catch (error) {
    cachedConnection = null;

    console.error(`MongoDB Connection Error: ${error.message}`);

    throw error;
  }
};

module.exports = connectDB;