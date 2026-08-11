const mongoose = require('mongoose');

// Clear model in development to avoid OverwriteModelError
if (process.env.NODE_ENV === 'development' && mongoose.models.Category) {
  mongoose.deleteModel('Category');
}

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  }
});

module.exports =
  mongoose.models.Category ||
  mongoose.model('Category', categorySchema);