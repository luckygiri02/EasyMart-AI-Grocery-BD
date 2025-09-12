const jwt = require('jsonwebtoken');

// This function verifies the token and sets req.user.
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Assign the entire decoded object (e.g., { id, role, iat, exp })
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid.' });
  }
};

// This function checks if the user is a vendor.
const authorizeVendor = (req, res, next) => {
  if (req.user && req.user.role === 'vendor') {
    next(); // User is a vendor, proceed.
  } else {
    // If req.user doesn't exist or role is wrong, deny access.
    return res.status(403).json({ message: 'Forbidden: Vendor access required.' });
  }
};

module.exports = { auth, authorizeVendor };