const mongoose = require('mongoose');

// Clear model in development to avoid OverwriteModelError
if (process.env.NODE_ENV === 'development' && mongoose.models.Brand) {
  mongoose.deleteModel('Brand');
}

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
});

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema);