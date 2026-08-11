const Product = require("../models/Product");
const Deal = require("../models/Deal");
const ChatSession = require("../models/ChatSession");
const crypto = require("crypto");

// Helper: Generate sessionId
const generateSessionId = () => {
  return crypto.randomBytes(16).toString("hex");
};

// Helper: Apply deal to product
const applyDealToProduct = async (product) => {
  const now = new Date();

  const deal = await Deal.findOne({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { applyToAllProducts: true },
      { products: product._id },
      { categories: product.categoryId }
    ]
  }).lean();

  if (!deal) {
    return {
      discountedPrice: product.price,
      savingsPercentage: 0,
      dealName: null
    };
  }

  let discountedPrice = product.price;
  let savingsPercentage = 0;

  if (deal.dealType === "percentage_discount") {
    savingsPercentage = deal.value;
    discountedPrice = product.price - (product.price * deal.value) / 100;
  }

  if (deal.dealType === "fixed_discount") {
    discountedPrice = product.price - deal.value;
    savingsPercentage = Math.round((deal.value / product.price) * 100);
  }

  return {
    discountedPrice: Math.round(discountedPrice),
    savingsPercentage,
    dealName: deal.name
  };
};

// Helper: Save messages into DB
const saveMessageToSession = async (sessionId, sender, text, userIp) => {
  let session = await ChatSession.findOne({ sessionId });

  if (!session) {
    session = new ChatSession({
      sessionId,
      userIp,
      messages: []
    });
  }

  session.messages.push({ sender, text });
  await session.save();
};

// ----------------------------------
// CHATBOT MAIN API
// ----------------------------------
exports.askChatbot = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || message.trim() === "") {
      return res.json({ reply: "Please type your question 😊" });
    }

    const msg = message.toLowerCase();
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Generate sessionId if not provided
    const currentSessionId = sessionId || generateSessionId();

    // Save user message
    await saveMessageToSession(currentSessionId, "user", message, clientIp);

    // ----------------------------------
    // DEAL / DISCOUNT COMMANDS
    // ----------------------------------
    if (
      msg.includes("today deals") ||
      msg.includes("todays deals") ||
      msg.includes("offers") ||
      msg.includes("discount") ||
      msg.includes("deal")
    ) {
      const now = new Date();

      const activeDeals = await Deal.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      }).lean();

      if (!activeDeals.length) {
        const reply = "❌ Sorry! Aaj koi active deals available nahi hai.";
        await saveMessageToSession(currentSessionId, "bot", reply, clientIp);
        return res.json({ reply, sessionId: currentSessionId });
      }

      let reply = "🔥 Today's Active Deals:\n\n";

      activeDeals.forEach((deal, index) => {
        reply += `${index + 1}. ${deal.name} (${deal.dealType}) - Value: ${deal.value}\n`;
      });

      reply += "\n🛒 You can ask like: 'Milk price' or 'Rice available'.";

      await saveMessageToSession(currentSessionId, "bot", reply, clientIp);

      return res.json({
        reply,
        sessionId: currentSessionId
      });
    }

    // ----------------------------------
    // BASIC FAQ
    // ----------------------------------
    if (msg.includes("delivery")) {
      const reply =
        "🚚 Delivery usually takes 30-60 minutes depending on your location.";
      await saveMessageToSession(currentSessionId, "bot", reply, clientIp);
      return res.json({ reply, sessionId: currentSessionId });
    }

    if (msg.includes("payment")) {
      const reply =
        "💳 We support Cash on Delivery, UPI, Debit Card and Credit Card.";
      await saveMessageToSession(currentSessionId, "bot", reply, clientIp);
      return res.json({ reply, sessionId: currentSessionId });
    }

    if (msg.includes("contact") || msg.includes("support")) {
      const reply =
        "📞 You can contact our support team through Contact Page or call: +91-XXXXXXXXXX";
      await saveMessageToSession(currentSessionId, "bot", reply, clientIp);
      return res.json({ reply, sessionId: currentSessionId });
    }

    // ----------------------------------
    // PRODUCT SEARCH
    // ----------------------------------
    const keywords = msg.split(" ").filter((w) => w.length > 2);

    if (keywords.length === 0) {
      const reply =
        "Please type a valid product name like 'Milk price' or 'Rice available' 🙂";
      await saveMessageToSession(currentSessionId, "bot", reply, clientIp);
      return res.json({ reply, sessionId: currentSessionId });
    }

    const product = await Product.findOne({
      isActive: true,
      $or: keywords.map((word) => ({
        name: { $regex: word, $options: "i" }
      }))
    }).populate("categoryId");

    if (!product) {
      const reply =
        "❌ Sorry! Mujhe ye product nahi mila 😅. Aap product ka exact naam try karo.";
      await saveMessageToSession(currentSessionId, "bot", reply, clientIp);
      return res.json({ reply, sessionId: currentSessionId });
    }

    // ----------------------------------
    // STOCK STATUS
    // ----------------------------------
    let stockText = "Available ✅";
    if (product.stock <= 0) stockText = "Out of Stock ❌";
    else if (product.stock > 0 && product.stock <= 5)
      stockText = "Limited Stock ⚠️";

    // ----------------------------------
    // APPLY DEAL
    // ----------------------------------
    const { discountedPrice, savingsPercentage, dealName } =
      await applyDealToProduct(product);

    // ----------------------------------
    // FINAL BOT REPLY
    // ----------------------------------
    let reply = `🛒 Product: ${product.name}\n`;
    reply += `📦 Category: ${product.categoryId?.name || "N/A"}\n`;
    reply += `📍 Stock Status: ${stockText}\n`;
    reply += `💰 Original Price: ₹${product.price}\n`;

    if (discountedPrice < product.price) {
      reply += `🔥 Discounted Price: ₹${discountedPrice}\n`;
      reply += `🎉 You Save: ${savingsPercentage}%\n`;
      reply += `🏷️ Deal: ${dealName}\n`;
    }

    reply += `⚖️ Unit: ${product.unit}\n`;

    if (product.description) {
      reply += `ℹ️ Info: ${product.description}\n`;
    }

    // Save bot reply
    await saveMessageToSession(currentSessionId, "bot", reply, clientIp);

    return res.json({
      reply,
      sessionId: currentSessionId
    });
  } catch (err) {
    console.error("Chatbot Error:", err);

    return res.status(500).json({
      reply: "⚠️ Server error. Please try again later."
    });
  }
};

// ----------------------------------
// GET CHAT HISTORY API
// ----------------------------------
exports.getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ message: "No chat history found" });
    }

    res.json(session);
  } catch (err) {
    console.error("Chat History Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
