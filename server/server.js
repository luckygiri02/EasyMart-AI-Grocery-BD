// server/server.js

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/product");
const orderRoutes = require("./routes/order");
const vendorRoutes = require("./routes/vendor");
const apiRoutes = require("./routes/apiRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const cartRoutes = require("./routes/cartRoutes");
const addressRoutes = require("./routes/address");
const paymentRoutes = require("./routes/paymentRoutes");
const dealRoutes = require("./routes/dealRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");
const analyticsRoutes = require("./routes/analytics");
const expiryRoutes = require("./routes/expiryRoutes");

const { GridFSBucket } = require("mongodb");
const mongoose = require("mongoose");

const aiService = require("./aiService");
const { sendPasswordResetEmail } = require("./utils/emailService");

const app = express();

let gridFSBucket = null;
let dbInitializationPromise = null;

/* =========================================================
   DATABASE + GRIDFS INITIALIZATION
========================================================= */

const initializeDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    if (!gridFSBucket) {
      gridFSBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "uploads",
      });

      if (aiService.setGridFSBucket) {
        aiService.setGridFSBucket(gridFSBucket);
      }

      console.log("GridFSBucket initialized");
    }

    return;
  }

  if (!dbInitializationPromise) {
    dbInitializationPromise = (async () => {
      await connectDB();

      console.log("MongoDB connected successfully");

      gridFSBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "uploads",
      });

      console.log("GridFSBucket initialized");

      if (aiService.setGridFSBucket) {
        aiService.setGridFSBucket(gridFSBucket);
      }
    })().catch((error) => {
      dbInitializationPromise = null;
      throw error;
    });
  }

  await dbInitializationPromise;
};

/* =========================================================
   DATABASE MIDDLEWARE
========================================================= */

app.use(async (req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    console.error("Database initialization error:", error);

    res.status(500).json({
      message: "Database connection failed",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests without origin
    // Useful for Postman/server-to-server requests
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked CORS origin:", origin);

    return callback(
      new Error("Not allowed by CORS")
    );
  },

  credentials: true,

  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(
  express.json({
    limit: "4mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "4mb",
  })
);

/* =========================================================
   BASIC REQUEST LOG
========================================================= */

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

/* =========================================================
   AI ROUTES
========================================================= */

app.post(
  "/api/ai/description",
  aiService.generateDescription
);

app.post(
  "/api/ai/recommendations",
  aiService.generateRecommendations
);

app.post(
  "/api/ai/search",
  aiService.generateSearch
);

app.post(
  "/api/ai/meal-plan",
  aiService.generateMealPlan
);

app.get(
  "/api/ai/test",
  aiService.testAI
);

app.delete(
  "/api/ai/cache",
  aiService.clearCache
);

/* =========================================================
   MAIN API ROUTES
========================================================= */

app.use("/api/auth", authRoutes);

app.use("/api/products", productRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/vendors", vendorRoutes);

app.use("/api", apiRoutes);

/*
  Categories intentionally remain PUBLIC.
  categoryRoutes.js should NOT use auth middleware
  for GET /
*/
app.use("/api/categories", categoryRoutes);

app.use("/api/brands", brandRoutes);

app.use("/api/deals", dealRoutes);

app.use("/api/cart", cartRoutes);

app.use("/api/addresses", addressRoutes);

app.use("/api/payment", paymentRoutes);

app.use("/api/chatbot", chatbotRoutes);

app.use("/api/analytics", analyticsRoutes);

app.use("/api/expiry", expiryRoutes);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", async (req, res) => {
  try {
    await initializeDatabase();

    res.json({
      success: true,
      message: "EasyMart backend is healthy",
      database:
        mongoose.connection.readyState === 1
          ? "connected"
          : "disconnected",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Backend health check failed",
      error: error.message,
    });
  }
});

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "EasyMart Backend is running",
    ai: "Gemma 3 4B via OpenRouter",
  });
});

/* =========================================================
   DEBUG EMAIL ROUTE
========================================================= */

app.get("/debug/send-email", async (req, res) => {
  /*
    You can remove this before final production deployment.
  */

  const to =
    req.query.to || "your-test-email@example.com";

  const name =
    req.query.name || "Debug User";

  const resetLink =
    req.query.link ||
    "https://example.com/reset?token=debugtoken";

  try {
    const result = await sendPasswordResetEmail(
      name,
      to,
      resetLink
    );

    console.log(
      "DEBUG SEND EMAIL RESULT:",
      JSON.stringify(result, null, 2)
    );

    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error(
      "DEBUG SEND EMAIL THROW:",
      err
    );

    return res.status(500).json({
      ok: false,
      error: String(err),
    });
  }
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {
  console.error("Global server error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : undefined,
  });
});

/* =========================================================
   LOCAL DEVELOPMENT
========================================================= */

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(
          `Server running on port ${PORT}`
        );

        console.log(
          `Health: http://localhost:${PORT}/health`
        );

        console.log(
          `AI Test: http://localhost:${PORT}/api/ai/test`
        );
      });
    })
    .catch((error) => {
      console.error(
        "Failed to start local server:",
        error
      );

      process.exit(1);
    });
}

/* =========================================================
   EXPORT FOR VERCEL
========================================================= */

module.exports = app;