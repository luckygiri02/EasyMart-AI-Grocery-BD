const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const { auth } = require('../middleware/auth');

// All routes are protected
router.post('/', auth, dealController.createDeal);
router.get('/', auth, dealController.getVendorDeals);
router.get('/:id', auth, dealController.getDealById);
router.put('/:id', auth, dealController.updateDeal);
router.delete('/:id', auth, dealController.deleteDeal);

// Public route for getting product deals
router.get('/product/:productId', dealController.getProductDeals);

module.exports = router;