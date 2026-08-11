const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbotController");

// Ask chatbot
router.post("/ask", chatbotController.askChatbot);

// Get chat history by sessionId
router.get("/history/:sessionId", chatbotController.getChatHistory);

module.exports = router;
