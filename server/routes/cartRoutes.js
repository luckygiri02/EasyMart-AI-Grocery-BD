// server/routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { auth } = require('../middleware/auth');


// POPULATE CONFIG
const CART_POPULATE = [
  {
    path: 'items.productId',
    select: 'name price images categoryId',
    populate: { path: 'categoryId', select: 'name' }
  }
];

// GET /api/cart
router.get('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.json({ items: [], total: 0 });

    await cart.populate(CART_POPULATE);  // ← CORRECT

    const total = cart.items.reduce(
      (sum, i) => sum + i.priceAtAdd * i.quantity,
      0
    );

    res.json({ items: cart.items, total });
  } catch (err) {
    console.error('GET /api/cart error →', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/cart/add
router.post('/add', auth, async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  try {
    const product = await Product.findById(productId).select('price stock name images');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ message: 'Not enough stock' });

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

    const existing = cart.items.find(i => i.productId.toString() === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity, priceAtAdd: product.price });
    }

    await cart.save();
    await cart.populate(CART_POPULATE);  // ← CORRECT

    const total = cart.items.reduce((s, i) => s + i.priceAtAdd * i.quantity, 0);
    res.json({ items: cart.items, total });
  } catch (err) {
    console.error('POST /api/cart/add error →', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/cart/update
router.put('/update', auth, async (req, res) => {
  const { productId, quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ message: 'Quantity must be ≥ 1' });

  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const idx = cart.items.findIndex(i => i.productId.toString() === productId);
    if (idx === -1) return res.status(404).json({ message: 'Item not in cart' });

    const product = await Product.findById(productId).select('stock');
    if (product.stock < quantity) return res.status(400).json({ message: 'Not enough stock' });

    cart.items[idx].quantity = quantity;
    await cart.save();
    await cart.populate(CART_POPULATE);  // ← CORRECT

    const total = cart.items.reduce((s, i) => s + i.priceAtAdd * i.quantity, 0);
    res.json({ items: cart.items, total });
  } catch (err) {
    console.error('PUT /api/cart/update error →', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/cart/remove/:productId
router.delete('/remove/:productId', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    cart.items = cart.items.filter(i => i.productId.toString() !== req.params.productId);
    await cart.save();
    await cart.populate(CART_POPULATE);  // ← CORRECT

    const total = cart.items.reduce((s, i) => s + i.priceAtAdd * i.quantity, 0);
    res.json({ items: cart.items, total });
  } catch (err) {
    console.error('DELETE /api/cart/remove error →', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;