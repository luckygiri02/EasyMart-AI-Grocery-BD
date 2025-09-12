// server/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, authorizeVendor } = require('../middleware/auth');
const productController = require('../controllers/productController');

// Debug: Check if router is properly initialized
console.log('Router initialized:', typeof router);
console.log('Has post method:', typeof router.post === 'function');

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, authController.updateProfile);

// Vendor product routes
router.get('/products/vendor/me', auth, authorizeVendor, productController.getVendorProducts);
router.post('/products/upload-image', auth, authorizeVendor, productController.uploadImage);

module.exports = router;