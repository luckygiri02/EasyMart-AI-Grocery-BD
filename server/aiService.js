const axios = require('axios');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');

// Cache to reduce API calls
const aiCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// OpenRouter API configuration (moved to environment variables)
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Initialize GridFSBucket (to be set by server.js after connection)
let gridFSBucket = null;

const setGridFSBucket = (bucket) => {
  gridFSBucket = bucket;
};

const generateWithGemma = async (prompt, cacheKey = null) => {
  // Check cache first
  if (cacheKey && aiCache.has(cacheKey)) {
    const cached = aiCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Using cached AI response for:', cacheKey);
      return cached.response;
    }
  }

  try {
    console.log('Making request to Gemma 3 4B via OpenRouter with prompt:', prompt.substring(0, 100) + '...');

    const response = await axios.post(OPENROUTER_API_URL, {
      model: 'google/gemma-3-4b-it:free',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'EasyMart Grocery Store'
      }
    });

    const generatedText = response.data.choices[0].message.content.trim();

    // Cache the response
    if (cacheKey) {
      aiCache.set(cacheKey, {
        response: generatedText,
        timestamp: Date.now()
      });
    }

    return generatedText;
  } catch (error) {
    console.error('OpenRouter Gemma 3 4B API error:', error.response?.data || error.message);
    throw error;
  }
};

// Fallback description generator
function generateFallbackDescription(productName, category) {
  const descriptors = {
    'vegetables': ['Fresh', 'Organic', 'Crisp', 'Nutritious', 'Farm-fresh'],
    'fruits': ['Juicy', 'Sweet', 'Ripe', 'Vitamin-rich', 'Seasonal'],
    'dairy': ['Creamy', 'Fresh', 'Pure', 'High-quality', 'Farm-fresh'],
    'bakery': ['Freshly baked', 'Artisanal', 'Crusty', 'Soft', 'Homemade'],
    'beverages': ['Refreshing', 'Cold', 'Sparkling', 'Natural', 'Healthy'],
    'snacks': ['Crunchy', 'Tasty', 'Savory', 'Delicious', 'Satisfying'],
    'default': ['Premium', 'Quality', 'Excellent', 'Delicious', 'Perfect']
  };

  const benefits = {
    'vegetables': ['perfect for cooking', 'great for salads', 'ideal for healthy meals'],
    'fruits': ['perfect for snacking', 'great for desserts', 'ideal for smoothies'],
    'dairy': ['perfect for cooking', 'great for breakfast', 'ideal for baking'],
    'bakery': ['perfect with tea', 'great for breakfast', 'ideal for sandwiches'],
    'beverages': ['perfect refreshment', 'great thirst quencher', 'ideal for any time'],
    'snacks': ['perfect for munching', 'great for parties', 'ideal for movie nights'],
    'default': ['perfect for your needs', 'great for any occasion', 'ideal for your family']
  };

  const categoryKey = category.toLowerCase();
  const descList = descriptors[categoryKey] || descriptors.default;
  const benefitList = benefits[categoryKey] || benefits.default;

  const randomDesc = descList[Math.floor(Math.random() * descList.length)];
  const randomBenefit = benefitList[Math.floor(Math.random() * benefitList.length)];

  return `${randomDesc} ${productName} - ${randomBenefit}`;
}

// AI Endpoints
const generateDescription = async (req, res) => {
  try {
    const { productName, category } = req.body;

    if (!productName || !category) {
      return res.status(400).json({
        error: 'Missing required parameters: productName and category are required'
      });
    }

    const cacheKey = `desc:${productName}:${category}`;

    try {
      const prompt = `Generate a short, appealing description (under 150 characters) for a grocery product called "${productName}" in the "${category}" category. Return only the description text without any additional formatting or explanations.`;

      const description = await generateWithGemma(prompt, cacheKey);
      res.json({ content: description });
    } catch (apiError) {
      console.log('Using fallback description generator');
      const description = generateFallbackDescription(productName, category);
      res.json({ content: description });
    }
  } catch (error) {
    console.error('Description generation error:', error);
    const description = generateFallbackDescription(req.body.productName, req.body.category);
    res.json({ content: description });
  }
};

const generateRecommendations = async (req, res) => {
  try {
    const { products, userId } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Products array is required' });
    }

    const cacheKey = `rec:${userId}:${products.length}`;

    try {
      const productList = products.slice(0, 20).map(p => p.name).join(', ');
      const prompt = `As a grocery store recommendation system, suggest 4-6 complementary products from this list: ${productList}. 
      Return ONLY a JSON array of product names in this exact format: ["Product Name 1", "Product Name 2", "Product Name 3"]`;

      const response = await generateWithGemma(prompt, cacheKey);

      const jsonMatch = response.match(/\[[^\]]*\]/);
      if (jsonMatch) {
        try {
          const recommendedNames = JSON.parse(jsonMatch[0]);
          const recommendedProducts = products.filter(p =>
            recommendedNames.some(name => p.name.toLowerCase().includes(name.toLowerCase()))
          ).slice(0, 6);

          return res.json({ content: JSON.stringify(recommendedProducts.map(p => p._id)) });
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
        }
      }
    } catch (apiError) {
      console.log('Using fallback recommendations');
    }

    const recommendedProducts = products
      .filter(p => p.isActive)
      .sort(() => 0.5 - Math.random())
      .slice(0, 6)
      .map(p => p._id);

    res.json({ content: JSON.stringify(recommendedProducts) });
  } catch (error) {
    console.error('Recommendations error:', error);
    const recommendedProducts = req.body.products
      .filter(p => p.isActive)
      .sort(() => 0.5 - Math.random())
      .slice(0, 6)
      .map(p => p._id);

    res.json({ content: JSON.stringify(recommendedProducts) });
  }
};

const generateSearch = async (req, res) => {
  try {
    const { query, products } = req.body;

    if (!query || !products) {
      return res.status(400).json({ error: 'Query and products are required' });
    }

    const cacheKey = `search:${query}:${products.length}`;

    try {
      const productList = products.slice(0, 30).map(p => p.name).join(', ');
      const prompt = `Find grocery products related to the search query: "${query}". 
      Available products: ${productList}. 
      Return ONLY a JSON array of matching product names in this exact format: ["Product Name 1", "Product Name 2"]`;

      const response = await generateWithGemma(prompt, cacheKey);

      const jsonMatch = response.match(/\[[^\]]*\]/);
      if (jsonMatch) {
        try {
          const matchingNames = JSON.parse(jsonMatch[0]);
          const matchingProducts = products.filter(p =>
            matchingNames.some(name => p.name.toLowerCase().includes(name.toLowerCase()))
          );

          return res.json({ content: JSON.stringify(matchingProducts.map(p => p._id)) });
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
        }
      }
    } catch (apiError) {
      console.log('Using fallback search');
    }

    const matchingProducts = products.filter(product =>
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(query.toLowerCase()))
    );

    res.json({ content: JSON.stringify(matchingProducts.map(p => p._id)) });
  } catch (error) {
    console.error('Search error:', error);
    const matchingProducts = req.body.products.filter(product =>
      product.name.toLowerCase().includes(req.body.query.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(req.body.query.toLowerCase()))
    );

    res.json({ content: JSON.stringify(matchingProducts.map(p => p._id)) });
  }
};

const testAI = async (req, res) => {
  try {
    const prompt = "Hello, are you working? Respond briefly.";
    const response = await generateWithGemma(prompt);

    res.json({
      success: true,
      message: 'Gemma 3 4B via OpenRouter connection successful',
      response: response
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check your OpenRouter API key and internet connection'
    });
  }
};

const clearCache = (req, res) => {
  aiCache.clear();
  res.json({ success: true, message: 'Cache cleared' });
};

// Export all AI functions
module.exports = {
  setGridFSBucket,
  generateDescription,
  generateRecommendations,
  generateSearch,
  testAI,
  clearCache
};