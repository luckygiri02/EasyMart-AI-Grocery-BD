const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/VendorController');
const { authorizeVendor } = require('../middleware/auth');

router.post('/profile', authorizeVendor, vendorController.createVendorProfile);
router.get('/profile', authorizeVendor, vendorController.getVendorProfile);
router.put('/profile', authorizeVendor, vendorController.updateVendorProfile);
router.get('/products', authorizeVendor, vendorController.getVendorProducts);

module.exports = router;