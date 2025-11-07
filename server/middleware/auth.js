// middleware/auth.js
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Normalize: always set req.user.id
    req.user = {
      id: decoded.id || decoded._id,  // ← fallback to _id if id missing
      role: decoded.role
    };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid.' });
  }
};

const authorizeVendor = (req, res, next) => {
  if (req.user?.role === 'vendor') {
    next();
  } else {
    return res.status(403).json({ message: 'Forbidden: Vendor access required.' });
  }
};

module.exports = { auth, authorizeVendor };