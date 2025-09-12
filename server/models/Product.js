const mongoose = require('mongoose');

// Clear models in development to avoid OverwriteModelError during hot reload
if (process.env.NODE_ENV === 'development') {
  mongoose.deleteModel('Product');
}

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  price: { type: Number, required: true, min: 0 },
  images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }], // Updated to reference GridFS ObjectIds
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand', // Removed enum, handled dynamically in controller
  },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stock: { type: Number, required: true, default: 0, min: 0 },
  unit: { type: String, required: true, enum: ['kg', 'g', 'liter', 'ml', 'piece', 'pack', 'dozen'] },
  weight: { type: Number, min: 0, default: 0 },
  nutritionalInfo: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
  },
  expirationDate: { type: Date },
  tags: [{ type: String, trim: true }],
  embeddings: [{ type: Number }], // For AI search (optional)
  isActive: { type: Boolean, default: true },
  discount: {
    percentage: { type: Number, min: 0, max: 100, default: 0 }, // e.g., 10 for 10% off
    startDate: { type: Date },
    endDate: { type: Date },
  },
  availabilityStatus: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'limited', 'pre_order'],
    default: 'in_stock',
  },
  // NEW: Reference to deals associated with this product
  deals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal'
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // Explicitly define timestamps
});

// Add unique index on name and vendorId to prevent duplicates
productSchema.index({ name: 1, vendorId: 1 }, { unique: true });

// Add index for deals for better query performance
productSchema.index({ deals: 1 });

// Middleware to update updatedAt on save
productSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);