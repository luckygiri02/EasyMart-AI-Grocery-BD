const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth } = require('../middleware/auth');

// 1. Static/Specific Routes first
router.get('/vendor/me', auth, productController.getVendorProducts);
router.get('/utils/categories', productController.getCategories);
router.get('/utils/brands', productController.getBrands);

// 2. Image Routes
router.get('/image/:id', productController.getImageById);
router.get('/proxy-image/:id', auth, productController.getProxyImage);
router.get('/image-health/:id', productController.getImageHealth);

// 3. Main CRUD (Dynamic routes last)
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

router.post('/', auth, productController.createProduct);
router.put('/:id', auth, productController.updateProduct);
router.delete('/:id', auth, productController.deleteProduct);

router.post('/upload-image', auth, productController.uploadImage);


router.post('/import', auth, productController.importProducts);

module.exports = router;