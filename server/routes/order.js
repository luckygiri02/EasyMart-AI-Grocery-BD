const express = require("express");
const router = express.Router();

const PDFDocument = require("pdfkit");

const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,

  // 🔥 Vendor
  getVendorOrders,
  respondToOrder,
  getOnlineOrders,
  updateLiveStatus,

  // 🔥 PAYMENT
  markPaymentSuccessful

} = require("../controllers/orderController");

const {
  auth,
  authorizeVendor
} = require("../middleware/auth");

const Order = require("../models/Order");


/* ==========================================================
   🔥 VENDOR ROUTES
========================================================== */

// Get all vendor orders
router.get(
  "/vendor",
  auth,
  authorizeVendor,
  getVendorOrders
);

// Get accepted / online orders
router.get(
  "/vendor/online",
  auth,
  authorizeVendor,
  getOnlineOrders
);

// Vendor accept / reject order
router.put(
  "/vendor/respond/:orderId",
  auth,
  authorizeVendor,
  respondToOrder
);

// 🔥 LIVE TRACKING STATUS UPDATE
router.put(
  "/vendor/live-status/:id",
  auth,
  authorizeVendor,
  updateLiveStatus
);


/* ==========================================================
   👤 USER ROUTES
========================================================== */

// Create order
router.post(
  "/",
  auth,
  createOrder
);


// 🔥 PAYMENT SUCCESS UPDATE
router.put(
  "/:id/payment-success",
  auth,
  markPaymentSuccessful
);


// Get logged-in user's orders
router.get(
  "/",
  auth,
  getUserOrders
);


/* ==========================================================
   ❌ CANCEL ORDER
========================================================== */

router.put(
  "/:id/cancel",
  auth,
  async (req, res) => {
    try {

      const order = await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({
          message: "Order not found"
        });
      }

      // Security check
      if (order.userId.toString() !== req.user.id) {
        return res.status(403).json({
          message: "Unauthorized"
        });
      }

      // Cannot cancel shipped/delivered
      if (
        ["shipped", "delivered"].includes(order.status)
      ) {
        return res.status(400).json({
          message: "Order cannot be cancelled now"
        });
      }

      order.status = "cancelled";

      await order.save();

      res.json(order);

    } catch (err) {

      console.error("Cancel order error:", err);

      res.status(500).json({
        message: "Cancel failed"
      });

    }
  }
);


/* ==========================================================
   📄 ORDER DETAILS
========================================================== */

// Get single order by ID
router.get(
  "/:id",
  auth,
  getOrderById
);

// Update order status
router.put(
  "/:id/status",
  auth,
  authorizeVendor,
  updateOrderStatus
);

// Delete order
router.delete(
  "/:id",
  auth,
  deleteOrder
);


/* ==========================================================
   📄 PDF INVOICE
========================================================== */

router.get(
  "/:id/invoice",
  auth,
  async (req, res) => {
    try {

      const order = await Order.findById(req.params.id)
        .populate(
          "products.productId",
          "name price"
        )
        .populate(
          "userId",
          "name email"
        );

      if (!order) {
        return res.status(404).json({
          message: "Order not found"
        });
      }

      const invoiceNumber =
        `EM-${new Date().getFullYear()}-${order._id
          .toString()
          .slice(-6)}`;

      const doc = new PDFDocument({
        size: "A4",
        margin: 50
      });

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Invoice_${invoiceNumber}.pdf`
      );

      doc.pipe(res);

      /* =========================
         HEADER
      ========================= */

      doc
        .fontSize(25)
        .fillColor("#10b981")
        .text(
          "EasyMart Invoice",
          {
            align: "center"
          }
        );

      doc.moveDown();

      doc
        .fontSize(12)
        .fillColor("#000")
        .text(`Invoice No: ${invoiceNumber}`);

      doc.text(`Order ID: ${order._id}`);

      doc.text(
        `Customer: ${order.userId.name}`
      );

      doc.text(
        `Email: ${order.userId.email}`
      );

      doc.moveDown();

      /* =========================
         PRODUCTS
      ========================= */

      doc.text(
        "--------------------------------------------------"
      );

      order.products.forEach(item => {

        doc.text(
          `${item.name} x ${item.quantity} = ₹${
            item.priceAtPurchase * item.quantity
          }`
        );

      });

      doc.text(
        "--------------------------------------------------"
      );

      /* =========================
         TOTAL
      ========================= */

      doc
        .fontSize(16)
        .fillColor("#111")
        .text(
          `Grand Total: ₹${order.totalAmount}`,
          {
            align: "right"
          }
        );

      doc.moveDown();

      /* =========================
         FOOTER
      ========================= */

      doc
        .fontSize(10)
        .fillColor("gray")
        .text(
          "Thank you for shopping with EasyMart ❤️",
          {
            align: "center"
          }
        );

      doc.end();

    } catch (err) {

      console.error(
        "Invoice Error:",
        err
      );

      res.status(500).send(
        "Error generating PDF"
      );

    }
  }
);

module.exports = router;