// controllers/dealController.js
const Deal = require('../models/Deal');
const Product = require('../models/Product');
const mongoose = require('mongoose');

/* ======================================
   CREATE DEAL (Vendor Only)
====================================== */
exports.createDeal = async (req, res) => {
  try {
    const {
      name,
      description,
      dealType,
      value,
      buyQuantity,
      getQuantity,
      comboProducts,
      minimumPurchase,
      maximumDiscount,
      startDate,
      endDate,
      products,
      categories,
      applyToAllProducts
    } = req.body;

    // 🔥 FIX 1: Deal must target something
    if (
      !applyToAllProducts &&
      (!products || products.length === 0) &&
      (!categories || categories.length === 0)
    ) {
      return res.status(400).json({
        message: 'Please select at least one category, product, or apply to all products'
      });
    }

    // Validate required fields
    if (!name || !dealType || !startDate || !endDate) {
      return res.status(400).json({ message: 'Name, deal type, start date, and end date are required' });
    }

    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Vendor access required.' });
    }

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const deal = new Deal({
      name,
      description,
      dealType,
      value,
      buyQuantity,
      getQuantity,
      comboProducts,
      minimumPurchase,
      maximumDiscount,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      vendorId: req.user.id,
      products,
      categories,
      applyToAllProducts
    });

    const savedDeal = await deal.save();
    res.status(201).json(savedDeal);

  } catch (error) {
    console.error('Error creating deal:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    
    res.status(500).json({ message: 'Server error while creating deal' });
  }
};


/* ======================================
   GET VENDOR DEALS
====================================== */
exports.getVendorDeals = async (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Vendor access required.' });
    }

    const deals = await Deal.find({ vendorId: req.user.id })
      .populate('products', 'name price')
      .populate('categories', 'name')
      .populate('comboProducts', 'name price');

    res.json(deals);
  } catch (error) {
    console.error('Error getting vendor deals:', error);
    res.status(500).json({ message: 'Server error while fetching deals' });
  }
};


/* ======================================
   GET DEAL BY ID (Vendor)
====================================== */
exports.getDealById = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('products', 'name price images')
      .populate('categories', 'name')
      .populate('comboProducts', 'name price images');

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (deal.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to view this deal.' });
    }

    res.json(deal);
  } catch (error) {
    console.error('Error getting deal:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid deal ID format' });
    }
    res.status(500).json({ message: 'Server error while fetching deal' });
  }
};


/* ======================================
   UPDATE DEAL
====================================== */
exports.updateDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (deal.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to update this deal.' });
    }

    const updatedDeal = await Deal.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('products', 'name price')
      .populate('categories', 'name')
      .populate('comboProducts', 'name price');

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error updating deal:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid deal ID format' });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    res.status(500).json({ message: 'Server error while updating deal' });
  }
};


/* ======================================
   DELETE DEAL
====================================== */
exports.deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (deal.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this deal.' });
    }

    await Deal.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid deal ID format' });
    }
    res.status(500).json({ message: 'Server error while deleting deal' });
  }
};


/* ======================================
   GET PRODUCT DEALS
====================================== */
exports.getProductDeals = async (req, res) => {
  try {
    const now = new Date();
    const deals = await Deal.find({
      $or: [
        { products: req.params.productId },
        { categories: { $in: await getProductCategories(req.params.productId) } },
        { applyToAllProducts: true }
      ],
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
    .populate('products', 'name price images')
    .populate('comboProducts', 'name price images');

    res.json(deals);
  } catch (error) {
    console.error('Error getting product deals:', error);
    res.status(500).json({ message: 'Server error while fetching product deals' });
  }
};


/* ======================================
   HELPER: PRODUCT CATEGORIES
====================================== */
async function getProductCategories(productId) {
  const product = await Product.findById(productId).populate('categoryId');
  return product.categoryId ? [product.categoryId._id] : [];
}


/* ======================================
   GET ACTIVE DEALS
====================================== */
exports.getActiveDeals = async (req, res) => {
  try {
    const now = new Date();
    
    const activeDeals = await Deal.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
    .populate('products', 'name price images')
    .populate('categories', 'name')
    .populate('comboProducts', 'name price images')
    .sort({ createdAt: -1 })
    .limit(20);

    res.json(activeDeals);
  } catch (error) {
    console.error('Error fetching active deals:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


/* ======================================
   GET ACTIVE DEALS WITH PRODUCTS
====================================== */
exports.getActiveDealsWithProducts = async (req, res) => {
  try {
    const now = new Date();

    const deals = await Deal.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).lean();

    const response = [];

    for (const deal of deals) {
      let products = [];

      if (deal.applyToAllProducts) {
        products = await Product.find().populate('categoryId');
      } 
      else if (deal.products && deal.products.length > 0) {
        products = await Product.find({ _id: { $in: deal.products } })
          .populate('categoryId');
      } 
      else if (deal.categories && deal.categories.length > 0) {
        products = await Product.find({ categoryId: { $in: deal.categories } })
          .populate('categoryId');
      }

      response.push({
        ...deal,
        products
      });
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching active deals with products:', error);
    res.status(500).json({ message: 'Failed to fetch deals with products' });
  }
};


/* ======================================
   GET PRODUCTS UNDER A DEAL (FOR FRONTEND)
====================================== */
exports.getDealProducts = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal || !deal.isActive) {
      return res.status(404).json({ message: 'Deal not found or inactive' });
    }

    const now = new Date();
    if (now < deal.startDate || now > deal.endDate) {
      return res.status(400).json({ message: 'Deal expired' });
    }

    let products = [];

    if (deal.applyToAllProducts) {
      products = await Product.find({ isActive: true }).populate('categoryId');
    } 
    else if (deal.products && deal.products.length > 0) {
      products = await Product.find({ _id: { $in: deal.products } }).populate('categoryId');
    } 
    else if (deal.categories && deal.categories.length > 0) {
      products = await Product.find({ categoryId: { $in: deal.categories } }).populate('categoryId');
    }

    const enrichedProducts = products.map(p => {
      let discountedPrice = p.price;
      let savingsPercentage = 0;

      if (deal.dealType === 'percentage_discount') {
        savingsPercentage = deal.value;
        discountedPrice = p.price - (p.price * deal.value) / 100;
      }

      if (deal.dealType === 'fixed_discount') {
        discountedPrice = p.price - deal.value;
        savingsPercentage = Math.round((deal.value / p.price) * 100);
      }

      return {
        ...p.toObject(),
        discountedPrice: Math.round(discountedPrice),
        savingsPercentage,
        dealEndDate: deal.endDate,
        dealName: deal.name
      };
    });

    res.json({
      deal,
      products: enrichedProducts
    });

  } catch (err) {
    console.error('getDealProducts error:', err);
    res.status(500).json({ message: 'Failed to fetch deal products' });
  }
};
