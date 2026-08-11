const express = require('express');
const router = express.Router();
const { createPaymentOrder, verifyPayment } = require('../controllers/paymentController');
const { auth } = require('../middleware/auth');

router.post('/create-order', auth, createPaymentOrder);
router.post('/verify', auth, verifyPayment);

module.exports = router;

