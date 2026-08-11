const mongoose = require("mongoose");


/* =========================================================
   FIX OVERWRITE MODEL ERROR
========================================================= */

if (
  process.env.NODE_ENV === "development"
) {

  try {

    mongoose.deleteModel("Product");

  } catch (err) {}
}


/* =========================================================
   PRODUCT SCHEMA
========================================================= */

const productSchema =
  new mongoose.Schema(

    {

      /* ===============================================
         BASIC INFO
      =============================================== */

      name: {

        type: String,

        required: true,

        trim: true
      },

      description: {

        type: String,

        default: "",

        trim: true
      },

      price: {

        type: Number,

        required: true,

        min: 0
      },


      /* ===============================================
         IMAGES
      =============================================== */

      images: [

        {
          type:
            mongoose.Schema.Types.ObjectId,

          ref: "fs.files"
        }
      ],


      /* ===============================================
         CATEGORY + BRAND
      =============================================== */

      categoryId: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Category",

        required: true
      },

      brandId: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Brand"
      },


      /* ===============================================
         VENDOR
      =============================================== */

      vendorId: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true
      },


      /* ===============================================
         INVENTORY
      =============================================== */

      stock: {

        type: Number,

        required: true,

        default: 0,

        min: 0
      },

      unit: {

        type: String,

        required: true,

        enum: [

          "kg",

          "g",

          "liter",

          "ml",

          "piece",

          "pack",

          "dozen"
        ]
      },

      weight: {

        type: Number,

        min: 0,

        default: 0
      },


      /* ===============================================
         NUTRITION
      =============================================== */

      nutritionalInfo: {

        calories: {

          type: Number,

          default: 0
        },

        protein: {

          type: Number,

          default: 0
        },

        carbs: {

          type: Number,

          default: 0
        },

        fat: {

          type: Number,

          default: 0
        }
      },


      /* ===============================================
         EXPIRY MANAGEMENT
      =============================================== */

      expiryDate: {

        type: Date,

        default: null
      },

      manufacturingDate: {

        type: Date,

        default: null
      },

      batchNumber: {

        type: String,

        default: ""
      },

      expiryStatus: {

        type: String,

        enum: [

          "fresh",

          "expiring-soon",

          "expired"
        ],

        default: "fresh"
      },


      /* ===============================================
         TAGS + AI
      =============================================== */

      tags: [

        {
          type: String,

          trim: true
        }
      ],

      embeddings: [

        {
          type: Number
        }
      ],


      /* ===============================================
         PRODUCT STATUS
      =============================================== */

      isActive: {

        type: Boolean,

        default: true
      },


      /* ===============================================
         DISCOUNT
      =============================================== */

      discount: {

        percentage: {

          type: Number,

          min: 0,

          max: 100,

          default: 0
        },

        startDate: {

          type: Date
        },

        endDate: {

          type: Date
        }
      },


      /* ===============================================
         AVAILABILITY
      =============================================== */

      availabilityStatus: {

        type: String,

        enum: [

          "in_stock",

          "out_of_stock",

          "limited",

          "pre_order"
        ],

        default: "in_stock"
      },


      /* ===============================================
         DEALS
      =============================================== */

      deals: [

        {
          type:
            mongoose.Schema.Types.ObjectId,

          ref: "Deal"
        }
      ]
    },

    {

      timestamps: {

        createdAt:
          "createdAt",

        updatedAt:
          "updatedAt"
      }
    }
  );


/* =========================================================
   INDEXES
========================================================= */

// Prevent duplicate products
productSchema.index(

  {
    name: 1,
    vendorId: 1
  },

  {
    unique: true
  }
);


// Deal query optimization
productSchema.index({

  deals: 1
});


// Expiry optimization
productSchema.index({

  expiryDate: 1
});


// Expiry status optimization
productSchema.index({

  expiryStatus: 1
});


/* =========================================================
   AUTO UPDATE updatedAt
========================================================= */

productSchema.pre(

  "save",

  function (next) {

    this.updatedAt =
      Date.now();

    next();
  }
);


/* =========================================================
   AUTO EXPIRY STATUS UPDATE
========================================================= */

productSchema.pre(

  "save",

  function (next) {

    if (!this.expiryDate) {

      return next();
    }

    const now =
      new Date();

    const expiry =
      new Date(
        this.expiryDate
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


    if (diffDays < 0) {

      this.expiryStatus =
        "expired";

    } else if (
      diffDays <= 7
    ) {

      this.expiryStatus =
        "expiring-soon";

    } else {

      this.expiryStatus =
        "fresh";
    }

    next();
  }
);


/* =========================================================
   EXPORT
========================================================= */

module.exports =

  mongoose.models.Product ||

  mongoose.model(
    "Product",
    productSchema
  );