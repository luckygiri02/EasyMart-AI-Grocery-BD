// 📁 server/aiService.js

const {
  GoogleGenerativeAI
} = require("@google/generative-ai");


/* =========================================================
   GEMINI SETUP
========================================================= */

const genAI =
  new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
  );


const model =
  genAI.getGenerativeModel({

    model:
      "gemini-2.0-flash"
  });


/* =========================================================
   CACHE SYSTEM
========================================================= */

const aiCache = new Map();

const CACHE_DURATION =
  10 * 60 * 1000;


/* =========================================================
   GEMINI REQUEST
========================================================= */

const askGemini = async (
  prompt,
  cacheKey = null
) => {

  try {

    /* =========================
       CACHE CHECK
    ========================= */

    if (
      cacheKey &&
      aiCache.has(cacheKey)
    ) {

      const cached =
        aiCache.get(cacheKey);

      if (
        Date.now() -
          cached.timestamp <
        CACHE_DURATION
      ) {

        console.log(
          "⚡ Using Cached AI Response"
        );

        return cached.response;
      }
    }


    /* =========================
       GEMINI CALL
    ========================= */

    const result =
      await model.generateContent(
        prompt
      );

    const response =
      await result.response;

    const text =
      response.text();


    /* =========================
       SAVE CACHE
    ========================= */

    if (cacheKey) {

      aiCache.set(cacheKey, {

        response: text,

        timestamp:
          Date.now()
      });
    }

    return text;

  } catch (err) {

    console.log(
      "Gemini Error:",
      err.message
    );

    return JSON.stringify({

      mealName:
        "Healthy Veg Meal",

      mealDescription:
        "Healthy grocery-based meal.",

      items: [
        "Rice",
        "Tomato",
        "Onion",
        "Potato",
        "Salt",
        "Oil",
        "Turmeric",
        "Vegetables"
      ]
    });
  }
};


/* =========================================================
   HELPERS
========================================================= */

function safeJSONParse(text) {

  try {

    return JSON.parse(text);

  } catch (err) {

    const match =
      text.match(/\{[\s\S]*\}/);

    if (match) {

      try {

        return JSON.parse(
          match[0]
        );

      } catch {

        return null;
      }
    }

    return null;
  }
}


const NON_FOOD_KEYWORDS = [

  "soap",
  "detergent",
  "dishwash",
  "cleaner",
  "shampoo",
  "toothpaste",
  "facewash",
  "sanitizer",
  "cream",
  "perfume"
];


const normalizeText = (
  text
) => {

  return text
    .toLowerCase()
    .replace(
      /[^a-z0-9\s]/g,
      ""
    )
    .trim();
};


const isMatched = (
  ingredient,
  productName
) => {

  const ing =
    normalizeText(
      ingredient
    );

  const prod =
    normalizeText(
      productName
    );

  if (
    !ing ||
    !prod
  ) return false;

  if (
    prod.includes(ing)
  ) return true;

  if (
    ing.includes(prod)
  ) return true;

  return false;
};


/* =========================================================
   DESCRIPTION
========================================================= */

const generateDescription =
  async (req, res) => {

    try {

      const {
        productName,
        category
      } = req.body;

      const prompt = `
Generate a short grocery product description.

Product:
${productName}

Category:
${category}

Keep under 120 characters.
`;

      const response =
        await askGemini(
          prompt,
          `desc:${productName}`
        );

      res.json({
        content: response
      });

    } catch (err) {

      res.json({

        content:
          `Fresh ${req.body.productName}`
      });
    }
  };


/* =========================================================
   RECOMMENDATIONS
========================================================= */

const generateRecommendations =
  async (req, res) => {

    try {

      const {
        products
      } = req.body;

      if (
        !products ||
        !Array.isArray(products)
      ) {

        return res.status(400)
          .json({
            error:
              "Products required"
          });
      }


      const productList =
        products
          .slice(0, 20)
          .map(p => p.name)
          .join(", ");


      const prompt = `
Suggest 5 grocery products
from this list:

${productList}

Return only JSON array.
`;


      const response =
        await askGemini(
          prompt,
          `rec:${productList}`
        );


      const jsonMatch =
        response.match(
          /\[[^\]]*\]/
        );


      if (jsonMatch) {

        const names =
          JSON.parse(
            jsonMatch[0]
          );

        const matched =
          products.filter(p =>

            names.some(name =>

              p.name
                .toLowerCase()
                .includes(
                  name.toLowerCase()
                )
            )
          );

        return res.json({

          content:
            JSON.stringify(
              matched.map(
                p => p._id
              )
            )
        });
      }


      return res.json({

        content:
          JSON.stringify([])
      });

    } catch (err) {

      res.status(500).json({

        error:
          "Recommendation failed"
      });
    }
  };


/* =========================================================
   SMART SEARCH
========================================================= */

const generateSearch =
  async (req, res) => {

    try {

      const {
        query,
        products
      } = req.body;

      const matched =
        products.filter(product =>

          product.name
            .toLowerCase()
            .includes(
              query.toLowerCase()
            )
        );

      res.json({

        content:
          JSON.stringify(
            matched.map(
              p => p._id
            )
          )
      });

    } catch (err) {

      res.status(500).json({

        error:
          "Search failed"
      });
    }
  };


/* =========================================================
   MEAL PLANNER
========================================================= */

const generateMealPlan =
  async (req, res) => {

    try {

      const {
        query,
        products
      } = req.body;

      if (!query) {

        return res.status(400)
          .json({

            error:
              "Query required"
          });
      }


      const productNames =
        (products || [])
          .map(p => p.name)
          .slice(0, 80);


      const randomSeed =
        Math.floor(
          Math.random() * 99999
        );


      const prompt = `
You are an AI Meal Planner.

User wants:
"${query}"

IMPORTANT:
- Suggest unique dishes
- Only food items
- No soap/detergent
- Give 8-12 ingredients

Return JSON:

{
  "mealName":"Dish",
  "mealDescription":"Description",
  "items":["item1","item2"]
}

Random:
${randomSeed}
`;


      let aiResponse = "";


      try {

        aiResponse =
          await askGemini(
            prompt
          );

      } catch (err) {

        console.log(err);

        aiResponse =
          JSON.stringify({

            mealName:
              "Healthy Veg Meal",

            mealDescription:
              "Healthy grocery meal.",

            items: [
              "Rice",
              "Tomato",
              "Onion",
              "Salt",
              "Oil"
            ]
          });
      }


      let parsed =
        safeJSONParse(
          aiResponse
        );


      if (
        !parsed ||
        !parsed.items
      ) {

        parsed = {

          mealName:
            "Healthy Veg Meal",

          mealDescription:
            "Healthy grocery-based meal.",

          items: [
            "Rice",
            "Tomato",
            "Onion",
            "Potato",
            "Salt",
            "Oil"
          ]
        };
      }


      /* =========================
         FILTER NON FOOD
      ========================= */

      parsed.items =
        parsed.items.filter(item => {

          const check =
            normalizeText(item);

          return !NON_FOOD_KEYWORDS
            .some(bad =>

              check.includes(bad)
            );
        });


      /* =========================
         PRODUCT MATCHING
      ========================= */

      const availableItems =
        [];

      const missingItems =
        [];


      parsed.items.forEach(
        ingredient => {

          const found =
            productNames.some(
              prodName =>

                isMatched(
                  ingredient,
                  prodName
                )
            );

          if (found) {

            availableItems.push(
              ingredient
            );

          } else {

            missingItems.push(
              ingredient
            );
          }
        }
      );


      parsed.availableItems =
        availableItems;

      parsed.missingItems =
        missingItems;


      return res.json({

        content:
          JSON.stringify(parsed)
      });

    } catch (err) {

      console.log(
        "Meal Plan Error:",
        err.message
      );

      res.status(500).json({

        error:
          "Meal planner failed"
      });
    }
  };


/* =========================================================
   TEST AI
========================================================= */

const testAI =
  async (req, res) => {

    try {

      const response =
        await askGemini(
          "Say hello in one line."
        );

      res.json({

        success: true,

        response
      });

    } catch (err) {

      res.status(500).json({

        success: false,

        error:
          err.message
      });
    }
  };


/* =========================================================
   CLEAR CACHE
========================================================= */

const clearCache =
  (req, res) => {

    aiCache.clear();

    res.json({

      success: true,

      message:
        "AI cache cleared"
    });
  };


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  generateDescription,

  generateRecommendations,

  generateSearch,

  generateMealPlan,

  testAI,

  clearCache
};