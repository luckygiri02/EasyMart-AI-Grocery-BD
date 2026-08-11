const Vendor = require('../models/Vender');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const Order = require('../models/Order');

/* =========================
   REGISTER VENDOR
========================= */
exports.registerVendor = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      password,
      storeName,
      storeAddress,
      vendorPhone
    } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      phoneNumber,
      password: hashed,
      role: "vendor"
    });

    await user.save();

    const vendor = new Vendor({
      userId: user._id,
      storeName,
      address: storeAddress,
      phone: vendorPhone
    });

    await vendor.save();

    const token = jwt.sign(
      { id: user._id, role: "vendor" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "Vendor created",
      token,
      vendor
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   GET PROFILE
========================= */
exports.getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.user.id });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json(vendor);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   UPDATE PROFILE
========================= */
exports.updateVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { userId: req.user.id },
      req.body,
      { new: true }
    );

    res.json(vendor);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   PRODUCTS + SALES
========================= */
exports.getVendorProducts = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const products = await Product.find({ vendorId });

    const orders = await Order.find({
      "products.vendorId": vendorId
    });

    const salesMap = {};

    orders.forEach(order => {
      order.products.forEach(item => {
        if (item.vendorId.toString() === vendorId) {
          const pid = item.productId.toString();
          salesMap[pid] = (salesMap[pid] || 0) + item.quantity;
        }
      });
    });

    const finalProducts = products.map(p => {
      const obj = p.toObject();
      obj.salesCount = salesMap[p._id.toString()] || 0;
      return obj;
    });

    res.json(finalProducts);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   VENDOR ORDERS
========================= */
exports.getVendorOrders = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const orders = await Order.find({
      "products.vendorId": vendorId
    }).sort({ createdAt: -1 });

    // 🔥 FILTER ONLY THIS VENDOR PRODUCTS
    const filteredOrders = orders.map(order => {
      const items = order.products.filter(
        p => p.vendorId.toString() === vendorId
      );

      return {
        ...order.toObject(),
        products: items
      };
    });

    res.json(filteredOrders);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

