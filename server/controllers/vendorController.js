const Vendor = require('../models/Vender');
  const Product = require('../models/Product');

  exports.createVendorProfile = async (req, res) => {
    try {
      const { storeName, address, phone } = req.body;
      if (!storeName || !address || !phone) {
        return res.status(400).json({ message: 'Store name, address, and phone are required' });
      }

      const existingVendor = await Vendor.findOne({ userId: req.user.id });
      if (existingVendor) {
        return res.status(400).json({ message: 'Vendor profile already exists' });
      }

      const vendor = new Vendor({
        userId: req.user.id,
        storeName,
        address,
        phone,
      });

      await vendor.save();
      res.status(201).json({ message: 'Vendor profile created successfully', vendor });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  exports.getVendorProfile = async (req, res) => {
    try {
      const vendor = await Vendor.findOne({ userId: req.user.id }).populate('userId');
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  exports.updateVendorProfile = async (req, res) => {
    try {
      const vendor = await Vendor.findOneAndUpdate(
        { userId: req.user.id },
        req.body,
        { new: true, runValidators: true }
      );
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  exports.getVendorProducts = async (req, res) => {
    try {
      const products = await Product.find({ vendorId: req.user.id });
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };