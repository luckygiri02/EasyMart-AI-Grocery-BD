const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'vendor'], default: 'user' },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' },
  },
  alternatePhone: { type: String },
  preferences: {
    receivePromotions: { type: Boolean, default: false },
    preferredDeliveryTime: { type: String },
  },
  paymentMethods: [{
    type: { type: String, enum: ['credit_card', 'debit_card', 'upi', 'cash_on_delivery'], required: true },
    details: { type: String },
    isDefault: { type: Boolean, default: false },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
});

// Export the model, checking if it already exists
module.exports = mongoose.models.User || mongoose.model('User', userSchema);