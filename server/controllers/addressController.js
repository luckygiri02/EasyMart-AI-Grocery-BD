// server/controllers/addressController.js
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * GET /api/addresses
 * Return user's saved addresses
 */
const getAddresses = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const user = await User.findById(userId).select('addresses address');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Ensure addresses is an array (defensive)
    const savedAddresses = Array.isArray(user.addresses) ? user.addresses : [];

    // If user still has legacy address field and addresses array is empty, include it as fallback
    const legacy = user.address && savedAddresses.length === 0 ? [{
      _id: new mongoose.Types.ObjectId(), // <- FIX: use `new`
      label: 'Primary',
      street: user.address.street || '',
      city: user.address.city || '',
      state: user.address.state || '',
      postalCode: user.address.postalCode || '',
      country: user.address.country || 'India',
      isDefault: true
    }] : [];

    return res.json({ addresses: savedAddresses.length ? savedAddresses : legacy });
  } catch (error) {
    console.error('getAddresses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/addresses
 * Body: { label, street, city, state, postalCode, country, phone, setDefault (optional boolean) }
 */
const addAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const { label, street, city, state, postalCode, country, phone, setDefault } = req.body;
    if (!street || !city || !state || !postalCode) {
      return res.status(400).json({ message: 'Complete address required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // initialize addresses array if not present (defensive)
    if (!Array.isArray(user.addresses)) user.addresses = [];

    // If setDefault === true, unset other defaults
    if (setDefault) {
      user.addresses.forEach(a => a.isDefault = false);
    }

    const newAddress = {
      label: label || '',
      street,
      city,
      state,
      postalCode,
      country: country || 'India',
      phone: phone || '',
      isDefault: !!setDefault
    };

    user.addresses.push(newAddress);
    await user.save();

    // Return the last pushed address
    const created = user.addresses[user.addresses.length - 1];
    res.status(201).json(created);
  } catch (error) {
    console.error('addAddress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/addresses/:addressId
 * Update an existing address
 * Body: { label, street, city, state, postalCode, country, phone, setDefault }
 */
const updateAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { addressId } = req.params;
    const { label, street, city, state, postalCode, country, phone, setDefault } = req.body;

    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!Array.isArray(user.addresses)) user.addresses = [];

    const addr = user.addresses.id(addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });

    if (setDefault) {
      user.addresses.forEach(a => a.isDefault = false);
      addr.isDefault = true;
    }

    if (label !== undefined) addr.label = label;
    if (street !== undefined) addr.street = street;
    if (city !== undefined) addr.city = city;
    if (state !== undefined) addr.state = state;
    if (postalCode !== undefined) addr.postalCode = postalCode;
    if (country !== undefined) addr.country = country;
    if (phone !== undefined) addr.phone = phone;

    await user.save();
    res.json(addr);
  } catch (error) {
    console.error('updateAddress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * DELETE /api/addresses/:addressId
 */
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { addressId } = req.params;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!Array.isArray(user.addresses)) user.addresses = [];

    const addr = user.addresses.id(addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });

    const wasDefault = addr.isDefault;
    addr.remove();
    // If deleted address was default and others exist, mark the first as default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    await user.save();
    res.json({ message: 'Address deleted' });
  } catch (error) {
    console.error('deleteAddress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/addresses/:addressId/set-default
 * Sets a saved address as default
 */
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { addressId } = req.params;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!Array.isArray(user.addresses)) user.addresses = [];

    const addr = user.addresses.id(addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });

    user.addresses.forEach(a => a.isDefault = false);
    addr.isDefault = true;

    await user.save();
    res.json({ message: 'Default address updated', address: addr });
  } catch (error) {
    console.error('setDefaultAddress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
