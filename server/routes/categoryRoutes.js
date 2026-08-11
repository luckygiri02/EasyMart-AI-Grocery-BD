const express = require('express');
const router = express.Router();
const Category = require('../models').Category;

// ✅ PUBLIC ROUTE (NO AUTH)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().select('_id name');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
