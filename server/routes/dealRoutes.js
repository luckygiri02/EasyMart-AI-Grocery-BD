const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const { auth } = require('../middleware/auth');

/* ================================
   PUBLIC ROUTES
================================ */

// Get active deals with their products
router.get('/active-with-products', dealController.getActiveDealsWithProducts);

// Get active deals only
router.get('/active', dealController.getActiveDeals);

// Get deals related to a product
router.get('/product/:productId', dealController.getProductDeals);

// 🔴 DEAL PRODUCTS PAGE ROUTE
router.get('/:id/products', dealController.getDealProducts);

/* ================================
   PROTECTED ROUTES (Vendor)
================================ */

router.post('/', auth, dealController.createDeal);
router.get('/', auth, dealController.getVendorDeals);

// Keep this AFTER above public routes
router.get('/:id', auth, dealController.getDealById);
router.put('/:id', auth, dealController.updateDeal);
router.delete('/:id', auth, dealController.deleteDeal);

module.exports = router;
