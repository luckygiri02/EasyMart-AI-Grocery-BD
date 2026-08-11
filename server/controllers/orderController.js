const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Cart = require("../models/Cart");

const mongoose = require("mongoose");


/* =========================================
   CREATE ORDER
========================================= */

exports.createOrder = async (
  req,
  res
) => {

  try {

    const {

      products,

      shippingAddress,

      addressId,

      paymentMethod,

      deliveryInstructions,

      deliveryTimeSlot,

      orderSource,

      discount,

    } = req.body;


    /* =========================================
       VALIDATION
    ========================================= */

    if (
      !products ||
      products.length === 0
    ) {

      return res.status(400).json({
        message:
          "Products required",
      });
    }


    if (!paymentMethod) {

      return res.status(400).json({
        message:
          "Payment method required",
      });
    }


    /* =========================================
       USER
    ========================================= */

    const user =
      await User.findById(
        req.user.id
      );

    if (!user) {

      return res.status(404).json({
        message:
          "User not found",
      });
    }


    /* =========================================
       ADDRESS
    ========================================= */

    let finalShippingAddress;


    // Saved address

    if (addressId) {

      const addr =
        user.addresses.id(
          addressId
        );

      if (!addr) {

        return res.status(400).json({
          message:
            "Address not found",
        });
      }

      finalShippingAddress = {

        street:
          addr.street,

        city:
          addr.city,

        state:
          addr.state,

        zipCode:
          addr.postalCode,

        country:
          addr.country,

        phone:
          addr.phone,
      };

    } else {

      const {

        street,

        city,

        state,

        zipCode,

      } = shippingAddress;


      if (
        !street ||
        !city ||
        !state ||
        !zipCode
      ) {

        return res.status(400).json({
          message:
            "Complete address required",
        });
      }


      finalShippingAddress = {

        street,

        city,

        state,

        zipCode,

        country:
          "India",
      };
    }


    /* =========================================
       VALIDATE PRODUCTS
    ========================================= */

    let totalAmount = 0;

    const validatedProducts = [];


    for (const item of products) {

      const product =
        await Product.findById(
          item.productId
        );

      if (!product) {

        return res.status(400).json({
          message:
            "Invalid product",
        });
      }


      if (
        product.stock <
        item.quantity
      ) {

        return res.status(400).json({
          message:
            `Low stock: ${product.name}`,
        });
      }


      validatedProducts.push({

        productId:
          product._id,

        name:
          product.name,

        image:
          product.images?.[0] ||
          null,

        quantity:
          item.quantity,

        priceAtPurchase:
          product.price,

        vendorId:
          product.vendorId,

        unit:
          product.unit,

        weight:
          product.weight,
      });


      totalAmount +=
        product.price *
        item.quantity;
    }


    /* =========================================
       DISCOUNT
    ========================================= */

    if (discount?.amount) {

      totalAmount -=
        discount.amount;
    }


    /* =========================================
       CREATE ORDER
    ========================================= */

    const order = new Order({

      userId:
        req.user.id,

      products:
        validatedProducts,

      totalAmount,

      shippingAddress:
        finalShippingAddress,

      paymentMethod,

      paymentStatus:
        "pending",

      status:
        "pending",

      vendorResponse:
        "pending",

      liveStatus:
        "Order Placed",

      estimatedDeliveryTime:
        30,

      aiPredictedDeliveryTime:
        30,

      priorityLevel:
        "medium",

      trackingId:
        `EZM-${Date.now()}`,

      deliveryInstructions,

      deliveryTimeSlot,

      orderSource,

      discount,
    });


    await order.save();


    /* =========================================
       CLEAR CART
    ========================================= */

    await Cart.findOneAndUpdate(
      {
        userId:
          req.user.id,
      },

      {
        $set: {
          items: [],
        },
      }
    );


    /* =========================================
       UPDATE STOCK
    ========================================= */

    for (const item of validatedProducts) {

      const product =
        await Product.findById(
          item.productId
        );

      product.stock -=
        item.quantity;


      if (
        product.stock <= 0
      ) {

        product.stock = 0;

        product.availabilityStatus =
          "out_of_stock";
      }

      await product.save();
    }


    /* =========================================
       RESPONSE
    ========================================= */

    res.status(201).json({

      success: true,

      message:
        "Order created successfully",

      order,
    });

  } catch (err) {

    console.error(
      "Create Order Error:",
      err
    );

    res.status(500).json({
      message:
        err.message,
    });
  }
};


/* =========================================
   USER ORDERS
========================================= */

exports.getUserOrders = async (
  req,
  res
) => {

  try {

    const orders =
      await Order.find({

        userId:
          req.user.id,
      })

      .sort({
        createdAt: -1,
      });

    res.json(orders);

  } catch (err) {

    res.status(500).json({
      message:
        err.message,
    });
  }
};


/* =========================================
   VENDOR ORDERS
========================================= */

exports.getVendorOrders = async (
  req,
  res
) => {

  try {

    const vendorId =
      new mongoose.Types.ObjectId(
        req.user.id
      );


    const orders =
      await Order.find({

        "products.vendorId":
          vendorId,

        paymentStatus:
          "completed",
      })

      .populate(
        "userId",
        "name phoneNumber"
      )

      .sort({
        createdAt: -1,
      });


    res.json(orders);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message:
        "Server error",
    });
  }
};


/* =========================================
   ACCEPT / REJECT ORDER
========================================= */

exports.respondToOrder = async (
  req,
  res
) => {

  try {

    const { orderId } =
      req.params;

    const {

      action,

      estimatedTime,

    } = req.body;


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
       ACCEPT
    ========================================= */

    if (action === "accept") {

      order.vendorResponse =
        "accepted";

      order.status =
        "accepted";

      order.liveStatus =
        "Preparing";

      order.acceptedAt =
        new Date();

      order.estimatedDeliveryTime =
        estimatedTime || 30;
    }


    /* =========================================
       REJECT
    ========================================= */

    if (action === "reject") {

      order.vendorResponse =
        "rejected";

      order.status =
        "cancelled";

      order.cancelledAt =
        new Date();
    }


    await order.save();

    res.json(order);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message:
        err.message,
    });
  }
};


/* =========================================
   GET ONLINE ORDERS
========================================= */

exports.getOnlineOrders = async (
  req,
  res
) => {

  try {

    const vendorId =
      req.user.id;

    const orders =
      await Order.find({

        "products.vendorId":
          vendorId,

        vendorResponse:
          "accepted",

        paymentStatus:
          "completed",
      })

      .populate(
        "userId",
        "name phoneNumber"
      )

      .sort({
        createdAt: -1,
      });


    res.json(orders);

  } catch (err) {

    res.status(500).json({
      message:
        err.message,
    });
  }
};


/* =========================================
   GET ORDER BY ID
========================================= */

exports.getOrderById = async (
  req,
  res
) => {

  try {

    const order =
      await Order.findById(
        req.params.id
      )

      .populate(
        "userId",
        "name phoneNumber"
      )

      .populate({

        path:
          "products.productId",

        select:
          "name price images description",
      });


    if (!order) {

      return res.status(404).json({
        message:
          "Order not found",
      });
    }


    res.json(order);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message:
        err.message,
    });
  }
};


/* =========================================
   UPDATE ORDER STATUS
========================================= */

exports.updateOrderStatus = async (
  req,
  res
) => {

  try {

    const { status } =
      req.body;

    const order =
      await Order.findById(
        req.params.id
      );

    if (!order) {

      return res.status(404).json({
        message:
          "Order not found",
      });
    }


    order.status = status;


    /* =========================================
       STATUS LOGIC
    ========================================= */

    if (status === "accepted") {

      order.liveStatus =
        "Preparing";

      order.estimatedDeliveryTime =
        30;

      order.acceptedAt =
        new Date();
    }


    if (status === "preparing") {

      order.liveStatus =
        "Preparing";

      order.estimatedDeliveryTime =
        20;
    }


    if (
      status ===
      "out_for_delivery"
    ) {

      order.liveStatus =
        "On The Way";

      order.estimatedDeliveryTime =
        10;

      order.dispatchedAt =
        new Date();
    }


    if (status === "delivered") {

      order.liveStatus =
        "Delivered";

      order.estimatedDeliveryTime =
        0;

      order.deliveredAt =
        new Date();
    }


    if (status === "cancelled") {

      order.cancelledAt =
        new Date();
    }


    await order.save();


    res.json({

      success: true,

      message:
        "Order status updated",

      order,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message:
        err.message,
    });
  }
};


/* =========================================
   DELETE ORDER
========================================= */

exports.deleteOrder = async (
  req,
  res
) => {

  try {

    await Order.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message:
        "Order deleted",
    });

  } catch (err) {

    res.status(500).json({
      message:
        err.message,
    });
  }
};


/* =========================================
   UPDATE LIVE STATUS
========================================= */

exports.updateLiveStatus = async (
  req,
  res
) => {

  try {

    const { status } =
      req.body;

    const order =
      await Order.findById(
        req.params.id
      );

    if (!order) {

      return res.status(404).json({
        message:
          "Order not found",
      });
    }


    order.liveStatus =
      status;

    await order.save();


    res.json({

      success: true,

      order,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message:
        err.message,
    });
  }
};


/* =========================================
   PAYMENT SUCCESS
========================================= */

exports.markPaymentSuccessful =
  async (
    req,
    res
  ) => {

    try {

      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {

        return res.status(404).json({
          message:
            "Order not found",
        });
      }


      order.paymentStatus =
        "completed";

      order.status =
        "pending";


      await order.save();


      res.json({

        success: true,

        message:
          "Payment successful",

        order,
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        message:
          "Server Error",
      });
    }
  };