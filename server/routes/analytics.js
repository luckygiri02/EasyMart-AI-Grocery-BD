const express =
  require("express");

const router =
  express.Router();

const {
  auth,
  authorizeVendor
} = require("../middleware/auth");

const {
  getVendorAnalytics
} = require("../controllers/analyticsController");


/* =========================================================
   VENDOR ANALYTICS
========================================================= */

router.get(
  "/vendor",
  auth,
  authorizeVendor,
  getVendorAnalytics
);

module.exports =
  router;