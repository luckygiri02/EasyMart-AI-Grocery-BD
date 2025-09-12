const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders, getOrderById, updateOrderStatus, deleteOrder } = require('../controllers/orderController');
const { auth, authorizeVendor } = require('../middleware/auth');

// Debug logs to verify imports
console.log('orderController:', { createOrder, getUserOrders, getOrderById, updateOrderStatus, deleteOrder });
console.log('authMiddleware:', { auth, authorizeVendor });

// For a user to create an order
router.post('/', auth, createOrder);

// For a user to get their own orders
router.get('/', auth, getUserOrders);

// For a user to get a specific order
router.get('/:id', auth, getOrderById);

// For a vendor/admin to update order status
router.put('/:id/status', auth, authorizeVendor, updateOrderStatus);

// For an admin to delete an order
router.delete('/:id', auth, deleteOrder);

module.exports = router;