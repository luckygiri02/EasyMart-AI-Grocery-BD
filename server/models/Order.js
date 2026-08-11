const mongoose = require("mongoose");

const Schema = mongoose.Schema;

/* =========================================
   ORDER ITEM
========================================= */

const orderItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    image: {
      type: String,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    priceAtPurchase: {
      type: Number,
      required: true,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    unit: {
      type: String,
    },

    weight: {
      type: Number,
    },
  },

  { _id: false }
);


/* =========================================
   SHIPPING ADDRESS
========================================= */

const shippingAddressSchema = new Schema(
  {
    street: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    state: {
      type: String,
      required: true,
    },

    zipCode: {
      type: String,
      required: true,
    },

    country: {
      type: String,
      required: true,
      default: "India",
    },
  },

  { _id: false }
);


/* =========================================
   MAIN ORDER SCHEMA
========================================= */

const orderSchema = new Schema(

  {
    /* USER */

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },


    /* PRODUCTS */

    products: [orderItemSchema],


    /* PRICE */

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },


    /* SHIPPING */

    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },


    /* PAYMENT */

    paymentMethod: {
      type: String,
      required: true,

      enum: [

        "credit_card",

        "debit_card",

        "upi",

        "cash_on_delivery",
      ],
    },


    paymentStatus: {
      type: String,

      enum: [

        "pending",

        "completed",

        "failed",
      ],

      default: "pending",
    },


    /* =========================================
       MAIN ORDER STATUS
    ========================================= */

    status: {
      type: String,

      required: true,

      enum: [

        "pending",

        "accepted",

        "preparing",

        "out_for_delivery",

        "delivered",

        "cancelled",
      ],

      default: "pending",

      index: true,
    },


    /* =========================================
       VENDOR RESPONSE
    ========================================= */

    vendorResponse: {
      type: String,

      enum: [

        "pending",

        "accepted",

        "rejected",
      ],

      default: "pending",
    },


    /* =========================================
       DELIVERY ETA
    ========================================= */

    estimatedDeliveryTime: {
      type: Number,
      default: 30,
    },


    /* =========================================
       LIVE TRACKING
    ========================================= */

    liveStatus: {
      type: String,

      enum: [

        "Order Placed",

        "Preparing",

        "Picked Up",

        "On The Way",

        "Delivered",
      ],

      default: "Order Placed",
    },


    /* =========================================
       MULTI VENDOR SUPPORT
    ========================================= */

    vendorStatus: [

      {
        vendorId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },

        status: {
          type: String,

          enum: [

            "pending",

            "accepted",

            "rejected",
          ],

          default: "pending",
        },

        estimatedTime: {
          type: String,
          default: "",
        },
      },
    ],


    /* =========================================
       DELIVERY
    ========================================= */

    deliveryInstructions: {
      type: String,
      default: "",
    },


    deliveryTimeSlot: {
      type: String,
    },


    orderSource: {
      type: String,
    },


    /* =========================================
       DISCOUNT
    ========================================= */

    discount: {

      code: {
        type: String,
        default: "",
      },

      amount: {
        type: Number,
        default: 0,
      },
    },


    /* =========================================
       NEW AI + TRACKING FIELDS
    ========================================= */

    trackingId: {
      type: String,
      default: "",
    },


    deliveryPartner: {
      type: String,
      default: "",
    },


    riderName: {
      type: String,
      default: "",
    },


    riderPhone: {
      type: String,
      default: "",
    },


    acceptedAt: {
      type: Date,
    },


    dispatchedAt: {
      type: Date,
    },


    deliveredAt: {
      type: Date,
    },


    cancelledAt: {
      type: Date,
    },


    cancellationReason: {
      type: String,
      default: "",
    },


    aiPredictedDeliveryTime: {
      type: Number,
      default: 0,
    },


    priorityLevel: {
      type: String,

      enum: [

        "low",

        "medium",

        "high",
      ],

      default: "medium",
    },


    customerNote: {
      type: String,
      default: "",
    },


    vendorNote: {
      type: String,
      default: "",
    },
  },

  {
    timestamps: true,
  }
);


/* =========================================
   INDEXES
========================================= */

orderSchema.index({
  createdAt: -1,
});

orderSchema.index({
  userId: 1,
  status: 1,
});

orderSchema.index({
  vendorResponse: 1,
});


/* =========================================
   EXPORT
========================================= */

module.exports =

  mongoose.models.Order ||

  mongoose.model(
    "Order",
    orderSchema
  );