const { Order, Product } = require('../models/Product');
const User = require('../models/User');

// Create a new order
const createOrder = async (req, res) => {
  try {
    const { products, shippingAddress, paymentMethod, deliveryInstructions, deliveryTimeSlot, orderSource, discount } = req.body;

    // Validate required fields
    if (!products || !products.length || !shippingAddress || !paymentMethod) {
      return res.status(400).json({ message: 'Products, shippingAddress, and paymentMethod are required' });
    }

    // Validate userId (from authenticated user)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'user') {
      return res.status(400).json({ message: 'Invalid or non-customer user' });
    }

    // Validate products and calculate totalAmount
    let totalAmount = 0;
    const validatedProducts = [];
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive || product.stock < item.quantity) {
        return res.status(400).json({ message: `Invalid or unavailable product: ${item.productId}` });
      }
      const vendor = await User.findById(product.vendorId);
      if (!vendor || vendor.role !== 'vendor') {
        return res.status(400).json({ message: `Invalid vendor for product: ${item.productId}` });
      }
      validatedProducts.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: product.price,
        vendorId: product.vendorId
      });
      totalAmount += product.price * item.quantity;
    }

    // Apply discount if provided
    if (discount && discount.amount) {
      totalAmount = Math.max(0, totalAmount - discount.amount);
    }

    // Validate shippingAddress
    const { street, city, state, zipCode, country } = shippingAddress;
    if (!street || !city || !state || !zipCode || !country) {
      return res.status(400).json({ message: 'Complete shipping address is required' });
    }

    // Validate paymentMethod
    if (!['credit_card', 'debit_card', 'upi', 'cash_on_delivery'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Validate deliveryTimeSlot if provided
    if (deliveryTimeSlot && !['morning', 'afternoon', 'evening'].includes(deliveryTimeSlot)) {
      return res.status(400).json({ message: 'Invalid delivery time slot' });
    }

    // Validate orderSource if provided
    if (orderSource && !['cart', 'direct', 'subscription'].includes(orderSource)) {
      return res.status(400).json({ message: 'Invalid order source' });
    }

    const order = new Order({
      userId,
      products: validatedProducts,
      totalAmount,
      shippingAddress,
      paymentMethod,
      deliveryInstructions: deliveryInstructions || '',
      deliveryTimeSlot: deliveryTimeSlot || user.preferences?.preferredDeliveryTime || 'morning',
      orderSource: orderSource || 'cart',
      discount: discount || { code: '', amount: 0 },
      status: 'pending'
    });

    const savedOrder = await order.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all orders for a user
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }
    const orders = await Order.find({ userId })
      .populate('products.productId', 'name price images')
      .populate('products.vendorId', 'name email')
      .populate('userId', 'name email');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('products.productId', 'name price images')
      .populate('products.vendorId', 'name email')
      .populate('userId', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.userId.toString() !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    res.json(order);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid order ID format' });
    res.status(500).json({ message: error.message });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    if (req.user?.role !== 'admin' && req.user?.role !== 'vendor') {
      return res.status(403).json({ message: 'Unauthorized: Admin or vendor access required' });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate('products.productId', 'name price images')
      .populate('products.vendorId', 'name email')
      .populate('userId', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid order ID format' });
    res.status(400).json({ message: error.message });
  }
};

// Delete order
const deleteOrder = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid order ID format' });
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createOrder, getUserOrders, getOrderById, updateOrderStatus, deleteOrder };