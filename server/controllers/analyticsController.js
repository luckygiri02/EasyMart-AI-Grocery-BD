// 📁 server/controllers/analyticsController.js

const Order = require("../models/Order");
const Product = require("../models/Product");
const mongoose = require("mongoose");


/* =========================================================
   VENDOR ANALYTICS
========================================================= */

exports.getVendorAnalytics =
  async (req, res) => {

    try {

      const vendorId =
        new mongoose.Types.ObjectId(
          req.user.id
        );


      /* =====================================================
         TOTAL ORDERS
      ===================================================== */

      const totalOrders =
        await Order.countDocuments({

          "products.vendorId":
            vendorId,

          paymentStatus:
            "completed"
        });


      /* =====================================================
         TOTAL REVENUE
      ===================================================== */

      const revenueResult =
        await Order.aggregate([

          {
            $match: {

              "products.vendorId":
                vendorId,

              paymentStatus:
                "completed"
            }
          },

          {
            $group: {

              _id: null,

              totalRevenue: {
                $sum:
                  "$totalAmount"
              }
            }
          }
        ]);


      const totalRevenue =
        revenueResult[0]
          ?.totalRevenue || 0;


      /* =====================================================
         PENDING ORDERS
      ===================================================== */

      const pendingOrders =
        await Order.countDocuments({

          "products.vendorId":
            vendorId,

          status:
            "pending",

          paymentStatus:
            "completed"
        });


      /* =====================================================
         DELIVERED ORDERS
      ===================================================== */

      const deliveredOrders =
        await Order.countDocuments({

          "products.vendorId":
            vendorId,

          status:
            "delivered",

          paymentStatus:
            "completed"
        });


      /* =====================================================
         TOTAL PRODUCTS
      ===================================================== */

      const totalProducts =
        await Product.countDocuments({

          vendorId
        });


      /* =====================================================
         LOW STOCK PRODUCTS
      ===================================================== */

      const lowStockProducts =
        await Product.find({

          vendorId,

          stock: {
            $lte: 5
          }
        })

        .select(
          "name stock images"
        )

        .limit(10);


      /* =====================================================
         TOP SELLING PRODUCTS
      ===================================================== */

      const topProducts =
        await Order.aggregate([

          {
            $match: {
              paymentStatus:
                "completed"
            }
          },

          {
            $unwind:
              "$products"
          },

          {
            $match: {
              "products.vendorId":
                vendorId
            }
          },

          {
            $group: {

              _id:
                "$products.productId",

              totalSold: {
                $sum:
                  "$products.quantity"
              },

              name: {
                $first:
                  "$products.name"
              },

              image: {
                $first:
                  "$products.image"
              }
            }
          },

          {
            $sort: {
              totalSold: -1
            }
          },

          {
            $limit: 5
          }
        ]);


      /* =====================================================
         RECENT ORDERS
      ===================================================== */

      const recentOrders =
        await Order.find({

          "products.vendorId":
            vendorId,

          paymentStatus:
            "completed"
        })

        .populate(
          "userId",
          "name"
        )

        .sort({
          createdAt: -1
        })

        .limit(5);


      /* =====================================================
         MONTHLY REVENUE
      ===================================================== */

      const monthlyRevenue =
        await Order.aggregate([

          {
            $match: {

              paymentStatus:
                "completed",

              "products.vendorId":
                vendorId
            }
          },

          {
            $group: {

              _id: {

                month: {
                  $month:
                    "$createdAt"
                }
              },

              revenue: {
                $sum:
                  "$totalAmount"
              }
            }
          },

          {
            $sort: {
              "_id.month": 1
            }
          }
        ]);


      /* =====================================================
         ADVANCED AI ENGINE
      ===================================================== */

      let aiInsights = [];


      // 🔥 Revenue Insight

      if (totalRevenue > 10000) {

        aiInsights.push(
          "🔥 Your sales are growing strongly this month."
        );
      }


      // ⚠ Low Stock Prediction

      if (lowStockProducts.length > 0) {

        aiInsights.push(
          `⚠ ${lowStockProducts.length} products may run out soon.`
        );
      }


      // 🏆 Top Product

      if (topProducts.length > 0) {

        aiInsights.push(
          `🏆 ${topProducts[0].name} is your current best seller.`
        );
      }


      // 🚚 Pending Orders

      if (pendingOrders > 5) {

        aiInsights.push(
          "🚚 High pending orders detected. Faster processing recommended."
        );
      }


      /* =====================================================
         STORE HEALTH SCORE
      ===================================================== */

      let healthScore = 100;

      if (lowStockProducts.length > 3) {
        healthScore -= 20;
      }

      if (pendingOrders > 5) {
        healthScore -= 15;
      }

      if (totalRevenue < 1000) {
        healthScore -= 10;
      }


      /* =====================================================
         REVENUE PREDICTION
      ===================================================== */

      const predictedRevenue =
        Math.round(totalRevenue * 1.18);


      /* =====================================================
         PEAK ORDER TIME
      ===================================================== */

      const peakHourData =
        await Order.aggregate([

          {
            $match: {
              paymentStatus:
                "completed"
            }
          },

          {
            $project: {

              hour: {
                $hour:
                  "$createdAt"
              }
            }
          },

          {
            $group: {

              _id:
                "$hour",

              count: {
                $sum: 1
              }
            }
          },

          {
            $sort: {
              count: -1
            }
          },

          {
            $limit: 1
          }
        ]);


      const peakHour =
        peakHourData[0]?._id || 19;


      /* =====================================================
         RESPONSE
      ===================================================== */

      res.json({

        success: true,

        analytics: {

          totalOrders,

          totalRevenue,

          pendingOrders,

          deliveredOrders,

          totalProducts,

          lowStockProducts,

          topProducts,

          recentOrders,

          monthlyRevenue,

          aiInsights,

          healthScore,

          predictedRevenue,

          peakHour
        }
      });

    } catch (err) {

      console.error(
        "Analytics Error:",
        err
      );

      res.status(500).json({

        success: false,

        message:
          "Analytics fetch failed"
      });
    }
  };