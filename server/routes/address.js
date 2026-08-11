// server/routes/address.js
const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { auth } = require('../middleware/auth'); // adapt path if different

router.get('/', auth, addressController.getAddresses);
router.post('/', auth, addressController.addAddress);
router.put('/:addressId', auth, addressController.updateAddress);
router.delete('/:addressId', auth, addressController.deleteAddress);
router.post('/:addressId/set-default', auth, addressController.setDefaultAddress);

module.exports = router;
