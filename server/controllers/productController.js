const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const User = require('../models/User');
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const multer = require('multer');

let gridFSBucket;

// Initialize GridFSBucket
mongoose.connection.once('open', () => {
  gridFSBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
  console.log('GridFSBucket initialized in productController');
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// In-memory idempotency solution (no Redis required)
const idempotencyCache = new Map();

const idempotencyMiddleware = async (req, res, next) => {
  try {
    const requestId = req.headers['x-request-id'];
    console.log('Received Request ID:', requestId);
    
    if (!requestId) return next();

    // Check if we've seen this request ID
    if (idempotencyCache.has(requestId)) {
      console.log('Duplicate request detected for ID:', requestId);
      return res.status(409).json({ message: 'Duplicate request detected' });
    }

    // Store request ID with timestamp
    idempotencyCache.set(requestId, Date.now());
    
    // Clean up old entries (older than 1 minute)
    const now = Date.now();
    for (const [key, timestamp] of idempotencyCache.entries()) {
      if (now - timestamp > 60000) {
        idempotencyCache.delete(key);
      }
    }

    next();
  } catch (error) {
    console.error('Error in idempotency middleware:', error);
    next();
  }
};

// @route   GET /api/products
// @desc    Get all products
// @access  Public
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate('vendorId', 'name email')
      .populate('categoryId', 'name')
      .populate('brandId', 'name');
    res.json(products);
  } catch (error) {
    console.error('Error getting all products:', error);
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendorId', 'name email')
      .populate('categoryId', 'name')
      .populate('brandId', 'name');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    console.error('Error getting product by ID:', error);
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/products/image/:id
// @desc    Get image by ID
// @access  Public
exports.getImageById = async (req, res) => {
  try {
    if (!gridFSBucket) {
      return res.status(500).json({ message: 'GridFS not initialized' });
    }

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid image ID format' });
    }

    const fileId = new ObjectId(req.params.id);
    
    const files = await gridFSBucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.set('Content-Type', files[0].contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    
    const downloadStream = gridFSBucket.openDownloadStream(fileId);
    
    downloadStream.on('error', (error) => {
      console.error('Error streaming image:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming image' });
      }
    });
    
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Error getting image:', error);
    if (error.message.includes('hex string') || error.message.includes('ObjectId')) {
      return res.status(400).json({ message: 'Invalid image ID format' });
    }
    res.status(500).json({ message: 'Server error while retrieving image' });
  }
};

// @route   GET /api/products/vendor/me
// @desc    Get all products for the logged-in vendor
// @access  Private
exports.getVendorProducts = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const products = await Product.find({ vendorId: req.user.id })
      .populate('categoryId', 'name')
      .populate('brandId', 'name');
    
    res.json(products);
  } catch (error) {
    console.error('Error getting vendor products:', error);
    res.status(500).json({ message: 'Server error while fetching vendor products' });
  }
};

// @route   POST /api/products
// @desc    Create a new product
// @access  Private (Vendor Only)
exports.createProduct = [
  idempotencyMiddleware,
  async (req, res) => {
    try {
      const {
        name, description, price, images, categoryId, brandId, stock, unit,
        weight, nutritionalInfo, expirationDate, tags, isActive, newCategory, newBrand,
      } = req.body;

      console.log('Creating product with data:', { name, vendorId: req.user.id });

      // Validate required fields
      if (!name || !price || (!categoryId && !newCategory) || stock === undefined || !unit) {
        return res.status(400).json({ message: 'Name, price, category, stock, and unit are required' });
      }

      if (req.user.role !== 'vendor') {
        return res.status(403).json({ message: 'Forbidden: Vendor access required.' });
      }

      let resolvedCategoryId = categoryId;
      if (newCategory) {
        const existingCategory = await Category.findOne({ name: newCategory.trim() });
        resolvedCategoryId = existingCategory ? existingCategory._id : (await Category.create({ name: newCategory.trim() }))._id;
      } else if (categoryId) {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
          return res.status(400).json({ message: 'Invalid category ID' });
        }
        const category = await Category.findById(categoryId);
        if (!category) return res.status(400).json({ message: 'Invalid category ID' });
        resolvedCategoryId = category._id;
      }

      let resolvedBrandId = brandId;
      if (newBrand) {
        const existingBrand = await Brand.findOne({ name: newBrand.trim() });
        resolvedBrandId = existingBrand ? existingBrand._id : (await Brand.create({ name: newBrand.trim() }))._id;
      } else if (brandId) {
        if (!mongoose.Types.ObjectId.isValid(brandId)) {
          resolvedBrandId = undefined;
        } else {
          const brand = await Brand.findById(brandId);
          resolvedBrandId = brand ? brand._id : undefined;
        }
      }

      const product = new Product({
        name: name.trim(),
        description: description ? description.trim() : '',
        price: parseFloat(price),
        images: images || [],
        categoryId: resolvedCategoryId,
        brandId: resolvedBrandId,
        vendorId: req.user.id,
        stock: parseInt(stock),
        unit,
        weight: parseFloat(weight) || 0,
        nutritionalInfo: nutritionalInfo || { calories: 0, protein: 0, carbs: 0, fat: 0 },
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        tags: tags ? tags.map(tag => tag.trim()) : [],
        isActive: isActive !== undefined ? isActive : true,
        availabilityStatus: 'in_stock',
      });

      const savedProduct = await product.save();
      console.log('Product saved successfully:', savedProduct._id);
      res.status(201).json(savedProduct);
    } catch (error) {
      console.error('Error creating product:', error);

      if (error.code === 11000) {
        return res.status(409).json({ message: 'Product with this name and vendor already exists' });
      }

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: 'Validation error', errors });
      }

      res.status(500).json({ message: 'Server error while creating product' });
    }
  },
];

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Private (Owner Only)
exports.updateProduct = [
  idempotencyMiddleware,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid product ID format' });
      }

      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (product.vendorId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to update this product.' });
      }

      const {
        name, description, price, images, categoryId, brandId, stock, unit,
        weight, nutritionalInfo, expirationDate, tags, isActive, newCategory, newBrand,
      } = req.body;

      const updateData = {
        name: name ? name.trim() : product.name,
        description: description ? description.trim() : product.description,
        price: price ? parseFloat(price) : product.price,
        images: images || product.images,
        stock: stock !== undefined ? parseInt(stock) : product.stock,
        unit: unit || product.unit,
        weight: weight ? parseFloat(weight) : product.weight,
        nutritionalInfo: nutritionalInfo || product.nutritionalInfo,
        expirationDate: expirationDate ? new Date(expirationDate) : product.expirationDate,
        tags: tags ? tags.map(tag => tag.trim()) : product.tags,
        isActive: isActive !== undefined ? isActive : product.isActive,
        availabilityStatus: product.availabilityStatus,
      };

      if (newCategory) {
        const existingCategory = await Category.findOne({ name: newCategory.trim() });
        updateData.categoryId = existingCategory ? existingCategory._id : (await Category.create({ name: newCategory.trim() }))._id;
      } else if (categoryId) {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
          return res.status(400).json({ message: 'Invalid category ID' });
        }
        const category = await Category.findById(categoryId);
        if (!category) return res.status(400).json({ message: 'Invalid category ID' });
        updateData.categoryId = category._id;
      }

      if (newBrand) {
        const existingBrand = await Brand.findOne({ name: newBrand.trim() });
        updateData.brandId = existingBrand ? existingBrand._id : (await Brand.create({ name: newBrand.trim() }))._id;
      } else if (brandId) {
        if (!mongoose.Types.ObjectId.isValid(brandId)) {
          updateData.brandId = product.brandId;
        } else {
          const brand = await Brand.findById(brandId);
          updateData.brandId = brand ? brand._id : product.brandId;
        }
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('categoryId', 'name').populate('brandId', 'name');

      res.json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);

      if (error.code === 11000) {
        return res.status(409).json({ message: 'Product with this name and vendor already exists' });
      }

      if (error.name === 'CastError') {
        return res.status(400).json({ message: 'Invalid product ID format' });
      }

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: 'Validation error', errors });
      }

      res.status(500).json({ message: 'Server error while updating product' });
    }
  },
];

// @route   DELETE /api/products/:id
// @desc    Delete a product
// @access  Private (Owner Only)
exports.deleteProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this product.' });
    }

    if (product.images && product.images.length > 0 && gridFSBucket) {
      for (const imageId of product.images) {
        try {
          if (ObjectId.isValid(imageId)) {
            await gridFSBucket.delete(new ObjectId(imageId));
          }
        } catch (error) {
          console.error('Error deleting image from GridFS:', error);
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    res.status(500).json({ message: 'Server error while deleting product' });
  }
};

// @route   POST /api/products/upload-image
// @desc    Upload an image to GridFS
// @access  Private
exports.uploadImage = [
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file uploaded' });
      }

      if (!gridFSBucket) {
        return res.status(500).json({ message: 'GridFS not initialized. Check MongoDB connection.' });
      }

      const filename = `${Date.now()}-${req.file.originalname}`;
      
      return new Promise((resolve, reject) => {
        const uploadStream = gridFSBucket.openUploadStream(filename, {
          contentType: req.file.mimetype,
        });

        uploadStream.end(req.file.buffer);

        uploadStream.on('error', (error) => {
          console.error('GridFS upload error:', error);
          reject(error);
        });

        uploadStream.on('finish', () => {
          res.status(201).json({
            id: uploadStream.id.toString(),
            filename: filename,
            message: 'Image uploaded successfully',
          });
          resolve();
        });
      });
    } catch (error) {
      console.error('Error in uploadImage:', error);
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size too large. Maximum size is 10MB.' });
      }
      if (error.message === 'Only image files are allowed') {
        return res.status(400).json({ message: 'Only image files are allowed' });
      }
      res.status(500).json({ message: 'Server error during image upload', error: error.message });
    }
  },
];

// @route   GET /api/products/utils/categories
// @desc    Get all categories for form dropdowns
// @access  Public
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().select('name _id');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error while fetching categories' });
  }
};

// @route   GET /api/products/utils/brands
// @desc    Get all brands for form dropdowns
// @access  Public
exports.getBrands = async (req, res) => {
  try {
    const brands = await Brand.find().select('name _id');
    res.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ message: 'Server error while fetching brands' });
  }
};

// @route   GET /api/products/proxy-image/:id
// @desc    Proxy image request with authentication
// @access  Private
exports.getProxyImage = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    if (!gridFSBucket) {
      return res.status(500).json({ message: 'GridFS not initialized' });
    }

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid image ID format' });
    }

    const fileId = new ObjectId(req.params.id);

    const files = await gridFSBucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.set('Content-Type', files[0].contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');

    const downloadStream = gridFSBucket.openDownloadStream(fileId);

    downloadStream.on('error', (error) => {
      console.error('Error streaming image:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming image' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('Error in getProxyImage:', error);
    if (error.message.includes('hex string') || error.message.includes('ObjectId')) {
      return res.status(400).json({ message: 'Invalid image ID format' });
    }
    res.status(500).json({ message: 'Server error while retrieving image' });
  }
};

// @route   GET /api/products/image-health/:id
// @desc    Check if an image exists and is accessible
// @access  Public
exports.getImageHealth = async (req, res) => {
  try {
    if (!gridFSBucket) {
      return res.status(500).json({ healthy: false, message: 'GridFS not initialized' });
    }

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ healthy: false, message: 'Invalid image ID format' });
    }

    const fileId = new ObjectId(req.params.id);
    const files = await gridFSBucket.find({ _id: fileId }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ healthy: false, message: 'Image not found' });
    }

    res.json({ 
      healthy: true, 
      message: 'Image exists',
      file: {
        id: files[0]._id.toString(),
        filename: files[0].filename,
        contentType: files[0].contentType,
        length: files[0].length
      }
    });
  } catch (error) {
    console.error('Error in image health check:', error);
    res.status(500).json({ healthy: false, message: 'Server error during health check' });
  }
};