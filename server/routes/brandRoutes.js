const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Brand = require('../models').Brand;

router.get('/', auth, async (req, res) => {
  try {
    const brands = await Brand.find().select('_id name');
    res.json(brands);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;