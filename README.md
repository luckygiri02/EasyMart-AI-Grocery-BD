
---

# 🔵 Backend Repo (EasyMart-AI-Grocery-BD)

```markdown
# ⚙️ EasyMart Backend

## 🚀 Overview
This repository contains the **backend** of EasyMart, an AI-powered grocery system built with **Node.js, Express.js, and MongoDB**.  
It provides secure REST APIs for authentication, product management, orders, and payments, while integrating with **Gemma AI** for intelligent features.

---

## 🛠️ Tech Stack
- Node.js  
- Express.js  
- MongoDB (Mongoose)  
- JWT Authentication  
- REST APIs  
- Gemma AI Integration  

---

## ⚙️ Installation & Setup

```bash
# Clone the repo
git clone https://github.com/luckygiri02/EasyMart-AI-Grocery-BD.git
cd EasyMart-AI-Grocery-BD

# Install dependencies
npm install

# Run backend server
npm start


PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret_key
OPENAI_API_KEY=your_openai_key
HUGGINGFACE_API_KEY=your_huggingface_key



Backend/
│── models/
│── routes/
│── controllers/
│── middleware/
│── server.js


| Method | Endpoint           | Description        |
| ------ | ------------------ | ------------------ |
| POST   | /api/auth/register | Register new user  |
| POST   | /api/auth/login    | User login         |
| GET    | /api/products      | Fetch all products |
| POST   | /api/orders        | Create new order   |
| GET    | /api/orders/\:id   | Get order by ID    |



✨ Features

🔐 User authentication & JWT-based authorization

🛒 Product & category management

📦 Order management

🤖 AI-powered recommendations (Gemma AI)

💳 Payment gateway integration



🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first.