const mongoose =
  require("mongoose");

require("dotenv").config();

const Product =
  require("../models/Product");


mongoose.connect(
  process.env.MONGO_URI
);


const updateProducts =
  async () => {

    try {

      const products =
        await Product.find();

      console.log(
        `Found ${products.length} products`
      );

      for (const product of products) {

        let changed = false;


        /* =========================
           EXPIRY DATE
        ========================= */

        if (
          product.expiryDate ===
          undefined
        ) {

          product.expiryDate =
            null;

          changed = true;
        }


        /* =========================
           MANUFACTURING DATE
        ========================= */

        if (
          product.manufacturingDate ===
          undefined
        ) {

          product.manufacturingDate =
            null;

          changed = true;
        }


        /* =========================
           BATCH NUMBER
        ========================= */

        if (
          product.batchNumber ===
          undefined
        ) {

          product.batchNumber =
            "";

          changed = true;
        }


        /* =========================
           EXPIRY STATUS
        ========================= */

        if (
          product.expiryStatus ===
          undefined
        ) {

          product.expiryStatus =
            "fresh";

          changed = true;
        }


        if (changed) {

          await product.save();

          console.log(

            `✅ Updated: ${product.name}`
          );
        }
      }

      console.log(
        "🎉 Migration Complete"
      );

      mongoose.disconnect();

    } catch (err) {

      console.log(err);

      mongoose.disconnect();
    }
  };


updateProducts();