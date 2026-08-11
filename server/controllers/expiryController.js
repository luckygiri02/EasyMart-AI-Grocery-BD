const Product =
  require("../models/Product");


/* =====================================================
   UPDATE EXPIRY STATUS
===================================================== */

const updateExpiryStatuses =
  async () => {

    try {

      const products =
        await Product.find();

      const now =
        new Date();

      for (const product of products) {

        if (!product.expiryDate) {

          continue;
        }

        const expiry =
          new Date(
            product.expiryDate
          );

        const diffDays =
          Math.ceil(

            (
              expiry - now
            ) /

            (
              1000 *
              60 *
              60 *
              24
            )
          );


        /* =========================================
           STATUS LOGIC
        ========================================= */

        if (diffDays < 0) {

          product.expiryStatus =
            "expired";

        } else if (diffDays <= 7) {

          product.expiryStatus =
            "expiring-soon";

        } else {

          product.expiryStatus =
            "fresh";
        }

        await product.save();
      }

    } catch (err) {

      console.log(
        "Expiry Update Error:",
        err.message
      );
    }
  };


/* =====================================================
   GET EXPIRING PRODUCTS
===================================================== */

const getExpiringProducts =
  async (req, res) => {

    try {

      await updateExpiryStatuses();

      const vendorId =
        req.user.id;

      const products =
        await Product.find({

          vendorId,

          expiryStatus:
            "expiring-soon"
        })
        .sort({
          expiryDate: 1
        });

      res.json({

        success: true,

        count:
          products.length,

        products
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({

        success: false,

        message:
          "Failed to fetch expiring products"
      });
    }
  };


/* =====================================================
   GET EXPIRED PRODUCTS
===================================================== */

const getExpiredProducts =
  async (req, res) => {

    try {

      await updateExpiryStatuses();

      const vendorId =
        req.user.id;

      const products =
        await Product.find({

          vendorId,

          expiryStatus:
            "expired"
        })
        .sort({
          expiryDate: 1
        });

      res.json({

        success: true,

        count:
          products.length,

        products
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({

        success: false,

        message:
          "Failed to fetch expired products"
      });
    }
  };


/* =====================================================
   GET FRESH PRODUCTS
===================================================== */

const getFreshProducts =
  async (req, res) => {

    try {

      await updateExpiryStatuses();

      const vendorId =
        req.user.id;

      const products =
        await Product.find({

          vendorId,

          expiryStatus:
            "fresh"
        });

      res.json({

        success: true,

        count:
          products.length,

        products
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({

        success: false,

        message:
          "Failed to fetch fresh products"
      });
    }
  };


/* =====================================================
   EXPIRY ANALYTICS
===================================================== */

const getExpiryAnalytics =
  async (req, res) => {

    try {

      await updateExpiryStatuses();

      const vendorId =
        req.user.id;

      const fresh =
        await Product.countDocuments({

          vendorId,

          expiryStatus:
            "fresh"
        });

      const expiring =
        await Product.countDocuments({

          vendorId,

          expiryStatus:
            "expiring-soon"
        });

      const expired =
        await Product.countDocuments({

          vendorId,

          expiryStatus:
            "expired"
        });

      res.json({

        success: true,

        analytics: {

          fresh,

          expiring,

          expired
        }
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({

        success: false,

        message:
          "Analytics failed"
      });
    }
  };


module.exports = {

  getExpiringProducts,

  getExpiredProducts,

  getFreshProducts,

  getExpiryAnalytics,

  updateExpiryStatuses
};