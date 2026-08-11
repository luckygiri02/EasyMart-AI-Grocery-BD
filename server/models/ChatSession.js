const mongoose = require("mongoose");

const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userIp: { type: String, default: null },

    messages: [
      {
        sender: { type: String, enum: ["user", "bot"], required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ChatSession ||
  mongoose.model("ChatSession", chatSessionSchema);
