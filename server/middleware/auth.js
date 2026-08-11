const jwt = require('jsonwebtoken');

/* =========================
   COMMON AUTH (USER + VENDOR)
========================= */
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      message: 'No token, authorization denied'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ BOTH USER + VENDOR
    req.user = {
      id: decoded.id,
      role: decoded.role
    };

    next();

  } catch (err) {
    return res.status(401).json({
      message: 'Token is not valid'
    });
  }
};

/* =========================
   VENDOR ONLY
========================= */
const authorizeVendor = (req, res, next) => {
  if (req.user?.role === 'vendor') {
    next();
  } else {
    return res.status(403).json({
      message: 'Access denied: Vendor only'
    });
  }
};

/* =========================
   EXPORT
========================= */
module.exports = {
  auth,
  authorizeVendor
};