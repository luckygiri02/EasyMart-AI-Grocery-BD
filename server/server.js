const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/product');
const orderRoutes = require('./routes/order');
const vendorRoutes = require('./routes/vendor');
const apiRoutes = require('./routes/apiRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const brandRoutes = require('./routes/brandRoutes');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const aiService = require('./aiService');

let gridFSBucket;

const app = express();

const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected successfully');

    // Initialize GridFSBucket after connection
    gridFSBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });
    console.log('GridFSBucket initialized');
    if (aiService.setGridFSBucket) {
      aiService.setGridFSBucket(gridFSBucket); // Pass GridFSBucket to aiService
    }

    const corsOptions = {
      origin: 'http://localhost:5173',
      credentials: true,
      optionsSuccessStatus: 200
    };

    app.use(cors(corsOptions));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // AI Routes
    app.post('/api/ai/description', aiService.generateDescription);
    app.post('/api/ai/recommendations', aiService.generateRecommendations);
    app.post('/api/ai/search', aiService.generateSearch);
    app.get('/api/ai/test', aiService.testAI);
    app.delete('/api/ai/cache', aiService.clearCache);

    // Import dealRoutes only after ensuring they exist
    let dealRoutes;
    try {
      dealRoutes = require('./routes/dealRoutes');
      console.log('Deal routes loaded successfully');
    } catch (error) {
      console.warn('Deal routes not available:', error.message);
      // Create empty router as fallback
      dealRoutes = express.Router();
    }

    // Other Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/vendors', vendorRoutes);
    app.use('/api', apiRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/brands', brandRoutes);
    app.use('/api/deals', dealRoutes);

    app.get('/', (req, res) => {
      res.send('EasyMart Backend is running with Gemma 3 4B via OpenRouter');
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Gemma 3 4B via OpenRouter integration enabled (via aiService)');
      console.log('Test API: http://localhost:5000/api/ai/test');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();