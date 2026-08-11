const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const User = require('../models/User');
const Deal = require('../models/Deal');
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const multer = require('multer');
const Vendor = require('../models/Vender');

let gridFSBucket;

// Initialize GridFSBucket
mongoose.connection.once('open', () => {
  gridFSBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
  console.log('GridFSBucket initialized in productController');
});

// Multer Config
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// Idempotency Logic
const idempotencyCache = new Map();
const idempotencyMiddleware = async (req, res, next) => {
  try {
    const requestId = req.headers['x-request-id'];
    if (!requestId) return next();
    if (idempotencyCache.has(requestId)) return res.status(409).json({ message: 'Duplicate request detected' });
    idempotencyCache.set(requestId, Date.now());
    const now = Date.now();
    for (const [key, timestamp] of idempotencyCache.entries()) {
      if (now - timestamp > 60000) idempotencyCache.delete(key);
    }
    next();
  } catch (error) { next(); }
};

/**
 * HELPER: injectDeals 
 * Ensures that product IDs and categories are compared as strings to avoid MERN mismatches.
 * Automatically handles date buffers for "Today's Deals".
 */
const injectDeals = async (products) => {
  const now = new Date();
  const allDeals = await Deal.find();
  
  // Filter for Active deals with a time buffer for the end of the day
  const activeDeals = allDeals.filter(deal => {
    const start = new Date(deal.startDate);
    const end = new Date(deal.endDate);
    // Set end date to the very end of that day (23:59:59) to prevent premature expiry
    end.setHours(23, 59, 59, 999);
    return deal.isActive && now >= start && now <= end;
  });

  console.log(`DEAL SYSTEM: Found ${allDeals.length} total. ${activeDeals.length} ACTIVE.`);

  return products.map(product => {
    // Convert Mongoose doc to plain JS object to allow adding new fields
    const p = product.toObject ? product.toObject() : JSON.parse(JSON.stringify(product));
    
    const pId = p._id.toString();
    const pCatId = p.categoryId?._id ? p.categoryId._id.toString() : (p.categoryId ? p.categoryId.toString() : null);

    // Find all deals that match this specific product, its category, or store-wide
    const applicableDeals = activeDeals.filter(deal => {
      const isStoreWide = deal.applyToAllProducts === true;
      const isProductMatch = deal.products?.some(id => id.toString() === pId);
      const isCategoryMatch = pCatId && deal.categories?.some(id => id.toString() === pCatId);
      return isStoreWide || isProductMatch || isCategoryMatch;
    });

    let bestDiscount = 0;
    let dealMeta = null;

    applicableDeals.forEach(deal => {
      let currentAmt = 0;
      if (deal.dealType === 'percentage_discount') {
        currentAmt = (p.price * deal.value) / 100;
      } else if (deal.dealType === 'fixed_discount') {
        currentAmt = deal.value;
      }

      if (currentAmt > bestDiscount) {
        bestDiscount = currentAmt;
        dealMeta = { name: deal.name, type: deal.dealType, value: deal.value };
      }
    });

    const discountedPrice = bestDiscount > 0 ? Math.round(p.price - bestDiscount) : p.price;
    const savingsPercentage = bestDiscount > 0 ? Math.round((bestDiscount / p.price) * 100) : 0;

    if (bestDiscount > 0) {
      console.log(`✅ Applied "${dealMeta.name}" to ${p.name}. Final: ₹${discountedPrice}`);
    }

    return {
      ...p,
      discountedPrice,
      savingsPercentage,
      discountPercentage: savingsPercentage, // Backward compatibility
      activeDeal: dealMeta
    };
  });
};

// --- ROUTES ---

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .populate('categoryId')
      .lean();

    const activeDeals = await Deal.find({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).lean();

    const enrichedProducts = products.map(product => {
      const deal = activeDeals.find(d =>
        d.applyToAllProducts ||
        d.products.some(p => p.toString() === product._id.toString()) ||
        (product.categoryId && d.categories.some(c => c.toString() === product.categoryId._id.toString()))
      );

      if (deal) {
        let discountedPrice = product.price;
        let savingsPercentage = 0;

        if (deal.dealType === 'percentage_discount') {
          savingsPercentage = deal.value;
          discountedPrice = product.price - (product.price * deal.value) / 100;
        }

        if (deal.dealType === 'fixed_discount') {
          discountedPrice = product.price - deal.value;
          savingsPercentage = Math.round((deal.value / product.price) * 100);
        }

        return {
          ...product,
          discountedPrice: Math.round(discountedPrice),
          savingsPercentage,
          dealEndDate: deal.endDate,
          dealName: deal.name,
          dealType: deal.dealType
        };
      }

      return product;
    });

    res.json(enrichedProducts);

  } catch (err) {
    console.error("getAllProducts error:", err);
    res.status(500).json({ message: "Failed to load products" });
  }
};
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('categoryId')
      .lean();

    if (!product) return res.status(404).json({ message: "Product not found" });

    const deal = await Deal.findOne({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
      $or: [
        { applyToAllProducts: true },
        { products: product._id },
        product.categoryId ? { categories: product.categoryId._id } : null
      ].filter(Boolean)
    }).lean();

    if (deal) {
      let discountedPrice = product.price;
      let savingsPercentage = 0;

      if (deal.dealType === 'percentage_discount') {
        savingsPercentage = deal.value;
        discountedPrice = product.price - (product.price * deal.value) / 100;
      }

      if (deal.dealType === 'fixed_discount') {
        discountedPrice = product.price - deal.value;
        savingsPercentage = Math.round((deal.value / product.price) * 100);
      }

      product.discountedPrice = Math.round(discountedPrice);
      product.savingsPercentage = savingsPercentage;
      product.dealEndDate = deal.endDate;
      product.dealName = deal.name;
      product.dealType = deal.dealType;
    }

    res.json(product);

  } catch (err) {
    console.error("getProductById error:", err);
    res.status(500).json({ message: "Failed to load product" });
  }
};


exports.getImageById = async (req, res) => {
  try {
    if (!gridFSBucket) return res.status(500).json({ message: 'GridFS not initialized' });
    const fileId = new ObjectId(req.params.id);
    const files = await gridFSBucket.find({ _id: fileId }).toArray();
    if (!files.length) return res.status(404).json({ message: 'Image not found' });
    res.set('Content-Type', files[0].contentType || 'image/jpeg');
    gridFSBucket.openDownloadStream(fileId).pipe(res);
  } catch (error) { res.status(500).json({ message: 'Error streaming image' }); }
};

exports.getVendorProducts = async (req, res) => {
  try {
    const products = await Product.find({ vendorId: req.user.id }).populate('categoryId');
    const result = await injectDeals(products);
    res.json(result);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};



exports.createProduct = [
  idempotencyMiddleware,
  async (req, res) => {
    try {

      // 🔥 CHECK: only vendor allowed
      const vendor = await Vendor.findOne({ userId: req.user.id });

      if (!vendor) {
        return res.status(403).json({
          message: "Only vendors can create products"
        });
      }

      const { name, price, categoryId, newCategory, stock, unit } = req.body;

      if (!name || !price || (!categoryId && !newCategory) || stock === undefined || !unit) {
        return res.status(400).json({ message: 'Required fields missing' });
      }

      let resCatId = categoryId;

      if (newCategory) {
        const exist = await Category.findOne({ name: newCategory.trim() });
        resCatId = exist ? exist._id : (await Category.create({ name: newCategory.trim() }))._id;
      }

      const product = new Product({
        ...req.body,
        categoryId: resCatId,
        vendorId: req.user.id
      });

      await product.save();

      res.status(201).json(product);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
];

exports.updateProduct = [
  idempotencyMiddleware,
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product || product.vendorId.toString() !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });
      const updated = await Product.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
      res.json(updated);
    } catch (error) { res.status(500).json({ message: error.message }); }
  }
];

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.vendorId.toString() !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });
    if (product.images?.length > 0) {
      for (const id of product.images) if (ObjectId.isValid(id)) await gridFSBucket.delete(new ObjectId(id));
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.uploadImage = [
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file || !gridFSBucket) return res.status(400).json({ message: 'Upload failed' });
      const uploadStream = gridFSBucket.openUploadStream(`${Date.now()}-${req.file.originalname}`, { contentType: req.file.mimetype });
      uploadStream.end(req.file.buffer);
      uploadStream.on('finish', () => res.status(201).json({ id: uploadStream.id.toString() }));
    } catch (error) { res.status(500).json({ message: 'Error' }); }
  }
];

exports.getProxyImage = async (req, res) => {
  try {
    if (!gridFSBucket) return res.status(500).send();
    const fileId = new ObjectId(req.params.id);
    const files = await gridFSBucket.find({ _id: fileId }).toArray();
    if (!files.length) return res.status(404).send();
    res.set('Content-Type', files[0].contentType || 'image/jpeg');
    gridFSBucket.openDownloadStream(fileId).pipe(res);
  } catch (error) { res.status(500).send(); }
};

exports.getCategories = async (req, res) => res.json(await Category.find().select('name _id'));
exports.getBrands = async (req, res) => res.json(await Brand.find().select('name _id'));
exports.getImageHealth = async (req, res) => {
  const files = await gridFSBucket.find({ _id: new ObjectId(req.params.id) }).toArray();
  res.json({ healthy: files.length > 0 });
};


const csv = require('csv-parser');
const XLSX = require('xlsx');
const stream = require('stream');

exports.importProducts = [
  multer().single('file'), // only file upload
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'File required' });
      }

      const results = [];

      // 📌 CSV FILE
      if (req.file.mimetype.includes('csv')) {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);

        bufferStream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', async () => {
            await saveProducts(results, req.user.id);
            res.json({ message: 'CSV Imported Successfully' });
          });

      } else {
        // 📌 EXCEL FILE
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        await saveProducts(data, req.user.id);
        res.json({ message: 'Excel Imported Successfully' });
      }

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Import failed' });
    }
  }
];

const saveProducts = async (rows, vendorId) => {

  for (const row of rows) {

    try {

      /* ============================================
         SMART FIELD DETECTION
      ============================================ */

      const categoryName =
        row.category ||
        row.categoryName ||
        "General";

      const brandName =
        row.brand ||
        row.brandName ||
        "Generic";

      const productName =
        row.name ||
        row.productName ||
        "Unnamed Product";


      /* ============================================
         CATEGORY
      ============================================ */

      let category =
        await Category.findOne({
          name: categoryName
        });

      if (!category) {

        category =
          await Category.create({
            name: categoryName
          });
      }


      /* ============================================
         BRAND
      ============================================ */

      let brand = null;

      if (brandName) {

        brand =
          await Brand.findOne({
            name: brandName
          });

        if (!brand) {

          brand =
            await Brand.create({
              name: brandName
            });
        }
      }


      /* ============================================
         PRODUCT CREATE
      ============================================ */

      await Product.create({

        name: productName,

        description:
          row.description ||
          "",

        price:
          Number(row.price) || 0,

        stock:
          Number(row.stock) || 0,

        unit:
          row.unit ||
          "piece",

        categoryId:
          category._id,

        brandId:
          brand?._id,

        vendorId,

        isActive: true
      });

      console.log(
        `✅ Imported: ${productName}`
      );

    } catch (err) {

      console.log(
        "❌ Row skipped:",
        row
      );

      console.log(err.message);
    }
  }
};