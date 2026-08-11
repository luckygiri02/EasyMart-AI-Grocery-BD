const mongoose = require('mongoose');

/* =========================
   ADDRESS SUB SCHEMA
========================= */
const addressSubSchema = new mongoose.Schema({
  label: { type: String, default: '' }, // Home, Office
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: 'India' },
  phone: { type: String, default: '' },
  isDefault: { type: Boolean, default: false }
}, { _id: true, timestamps: true });

/* =========================
   USER SCHEMA
========================= */
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: ['user', 'vendor', 'admin'],
    default: 'user'
  },

  /* =========================
     LEGACY (KEEP TEMP)
  ========================= */
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'India' }
  },

  /* =========================
     NEW SYSTEM (MAIN)
  ========================= */
  addresses: {
    type: [addressSubSchema],
    default: []
  },

  /* =========================
     EXTRA FIELDS
  ========================= */
  alternatePhone: { type: String },

  preferences: {
    receivePromotions: { type: Boolean, default: false },
    preferredDeliveryTime: { type: String }
  },

  paymentMethods: [{
    type: {
      type: String,
      enum: ['credit_card', 'debit_card', 'upi', 'cash_on_delivery']
    },
    details: String,
    isDefault: { type: Boolean, default: false }
  }],

  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },

  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Number }

}, { timestamps: true });

/* =========================
   🔥 AUTO DEFAULT ADDRESS FIX
========================= */
userSchema.pre('save', function (next) {
  if (this.addresses.length > 0) {
    const hasDefault = this.addresses.some(addr => addr.isDefault);

    if (!hasDefault) {
      this.addresses[0].isDefault = true;
    }
  }
  next();
});

/* =========================
   🔥 HELPER METHOD
========================= */
userSchema.methods.getDefaultAddress = function () {
  return this.addresses.find(addr => addr.isDefault);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);