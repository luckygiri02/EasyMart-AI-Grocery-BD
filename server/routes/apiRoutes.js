const express = require('express');
const { Category, Brand } = require('../models');
const router = express.Router();

router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching categories', error: err.message });
  }
});

router.get('/brands', async (req, res) => {
  try {
    const brands = await Brand.find();
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching brands', error: err.message });
  }
});

module.exports = router;