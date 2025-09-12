// controllers/dealController.js
const Deal = require('../models/Deal');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// @route   POST /api/deals
// @desc    Create a new deal
// @access  Private (Vendor Only)
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

// @route   GET /api/deals
// @desc    Get all deals for vendor
// @access  Private (Vendor Only)
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

// @route   GET /api/deals/:id
// @desc    Get deal by ID
// @access  Private (Vendor Only)
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

// @route   PUT /api/deals/:id
// @desc    Update a deal
// @access  Private (Vendor Only)
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

// @route   DELETE /api/deals/:id
// @desc    Delete a deal
// @access  Private (Vendor Only)
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

// @route   GET /api/deals/product/:productId
// @desc    Get active deals for a product
// @access  Public
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

// Helper function to get product categories
async function getProductCategories(productId) {
  const product = await Product.findById(productId).populate('categoryId');
  return product.categoryId ? [product.categoryId._id] : [];
}