const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth } = require('../middleware/auth');

// Product routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.get('/image/:id', productController.getImageById); // Existing image route
router.get('/proxy-image/:id', auth, productController.getProxyImage); // New proxy route
router.post('/', auth, productController.createProduct);
router.put('/:id', auth, productController.updateProduct);
router.delete('/:id', auth, productController.deleteProduct);
router.get('/vendor/me', auth, productController.getVendorProducts);
router.post('/upload-image', auth, productController.uploadImage);

module.exports = router;