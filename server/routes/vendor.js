const express = require('express');
const router = express.Router();

const vendorController = require('../controllers/vendorController');
const { auth, authorizeVendor } = require('../middleware/auth');


console.log("VendorController Keys:", Object.keys(vendorController));
console.log("VendorController Keys:", Object.keys(vendorController));
// 🔥 REGISTER (no auth)
router.post('/register', vendorController.registerVendor);

// 🔥 PROTECTED ROUTES
router.get('/profile', auth, authorizeVendor, vendorController.getVendorProfile);

router.put('/profile', auth, authorizeVendor, vendorController.updateVendorProfile);

router.get('/products', auth, authorizeVendor, vendorController.getVendorProducts);

router.get('/orders', auth, authorizeVendor, vendorController.getVendorOrders);

module.exports = router;