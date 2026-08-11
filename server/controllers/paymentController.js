const Razorpay = require("razorpay");

const crypto = require("crypto");

const Order = require("../models/Order");


/* =========================================
   CREATE PAYMENT ORDER
========================================= */

exports.createPaymentOrder =
  async (req, res) => {

    try {

      const { orderId } =
        req.body;


      /* =========================================
         CHECK KEYS
      ========================================= */

      if (
        !process.env.RAZORPAY_KEY_ID ||

        !process.env.RAZORPAY_KEY_SECRET
      ) {

        console.error(
          "PAYMENT ERROR: Missing Razorpay Keys"
        );

        return res.status(500).json({

          message:
            "Server config error: Missing Razorpay Keys",
        });
      }


      /* =========================================
         RAZORPAY INSTANCE
      ========================================= */

      const instance =
        new Razorpay({

          key_id:
            process.env
              .RAZORPAY_KEY_ID,

          key_secret:
            process.env
              .RAZORPAY_KEY_SECRET,
        });


      /* =========================================
         FIND ORDER
      ========================================= */

      const order =
        await Order.findById(
          orderId
        );

      if (!order) {

        return res.status(404).json({

          message:
            "Order not found",
        });
      }


      /* =========================================
         AMOUNT
      ========================================= */

      const amountInPaise =
        Math.round(
          order.totalAmount * 100
        );


      if (
        amountInPaise <= 0
      ) {

        return res.status(400).json({

          message:
            "Invalid payment amount",
        });
      }


      /* =========================================
         RAZORPAY OPTIONS
      ========================================= */

      const options = {

        amount:
          amountInPaise,

        currency:
          "INR",

        receipt:
          `receipt_${orderId}`,
      };


      /* =========================================
         CREATE ORDER
      ========================================= */

      const razorpayOrder =
        await instance.orders.create(
          options
        );


      res.json(
        razorpayOrder
      );

    } catch (error) {

      console.error(
        "Razorpay Create Error:",
        error
      );

      res.status(500).json({

        message:
          error.message,

        details:
          error,
      });
    }
  };


/* =========================================
   VERIFY PAYMENT
========================================= */

exports.verifyPayment =
  async (req, res) => {

    try {

      const {

        razorpay_order_id,

        razorpay_payment_id,

        razorpay_signature,

        internal_order_id,

      } = req.body;


      /* =========================================
         VERIFY SIGNATURE
      ========================================= */

      const body =

        razorpay_order_id
        + "|"
        + razorpay_payment_id;


      const expectedSignature =

        crypto

          .createHmac(

            "sha256",

            process.env
              .RAZORPAY_KEY_SECRET
          )

          .update(
            body.toString()
          )

          .digest("hex");


      /* =========================================
         VALID SIGNATURE
      ========================================= */

      if (
        expectedSignature ===
        razorpay_signature
      ) {

        const order =
          await Order.findById(
            internal_order_id
          );


        if (order) {

          /* PAYMENT */

          order.paymentStatus =
            "completed";

          order.paymentMethod =
            "upi";


          /* =========================================
             NEW LIVE TRACKING SYSTEM
          ========================================= */

       order.status =
  "pending";

order.vendorResponse =
  "pending";

order.liveStatus =
  "Order Placed";

order.estimatedDeliveryTime =
  30;


          await order.save();
        }


        return res.json({

          message:
            "Payment Verified",

          success: true,
        });
      }


      /* =========================================
         INVALID SIGNATURE
      ========================================= */

      return res.status(400).json({

        message:
          "Invalid Signature",

        success: false,
      });

    } catch (error) {

      console.error(
        "Verify Payment Error:",
        error
      );

      res.status(500).json({

        message:
          "Internal Server Error",

        success: false,
      });
    }
  };