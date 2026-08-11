const express =
  require("express");

const router =
  express.Router();


const {

  getExpiringProducts,

  getExpiredProducts,

  getFreshProducts,

  getExpiryAnalytics

} = require(
  "../controllers/expiryController"
);


const {
  auth
} = require(
  "../middleware/auth"
);


/* =====================================================
   EXPIRY ROUTES
===================================================== */


/* =========================================
   EXPIRING SOON PRODUCTS
========================================= */

router.get(

  "/expiring",

  auth,

  getExpiringProducts
);


/* =========================================
   EXPIRED PRODUCTS
========================================= */

router.get(

  "/expired",

  auth,

  getExpiredProducts
);


/* =========================================
   FRESH PRODUCTS
========================================= */

router.get(

  "/fresh",

  auth,

  getFreshProducts
);


/* =========================================
   ANALYTICS
========================================= */

router.get(

  "/analytics",

  auth,

  getExpiryAnalytics
);


module.exports = router;