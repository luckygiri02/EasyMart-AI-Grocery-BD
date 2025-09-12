const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  dealType: {
    type: String,
    enum: ['percentage_discount', 'fixed_discount', 'buy_x_get_y', 'combo_offer', 'free_shipping', 'bundle_offer'],
    required: true
  },
  value: {
    type: Number,
    required: function() {
      return this.dealType === 'percentage_discount' || this.dealType === 'fixed_discount';
    }
  },
  buyQuantity: {
    type: Number,
    required: function() {
      return this.dealType === 'buy_x_get_y';
    }
  },
  getQuantity: {
    type: Number,
    required: function() {
      return this.dealType === 'buy_x_get_y';
    }
  },
  comboProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  minimumPurchase: {
    type: Number,
    default: 0
  },
  maximumDiscount: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  applyToAllProducts: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
dealSchema.index({ vendorId: 1, isActive: 1 });
dealSchema.index({ startDate: 1, endDate: 1 });
dealSchema.index({ products: 1 });
dealSchema.index({ categories: 1 });

// Virtual for checking if deal is currently active
dealSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
});

// Method to check if deal applies to a specific product
dealSchema.methods.appliesToProduct = function(productId, categoryId) {
  if (this.applyToAllProducts) return true;
  if (this.products.includes(productId)) return true;
  if (this.categories.includes(categoryId)) return true;
  return false;
};

// Export the model correctly
module.exports = mongoose.model('Deal', dealSchema);