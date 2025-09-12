const mongoose = require('mongoose');
const { Category, Brand, Product } = require('./models');

const MONGODB_URI = 'mongodb://localhost:27017/easymart';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for seeding'))
  .catch(err => console.error('MongoDB connection error:', err));

const seedData = async () => {
  try {
    // Clear existing data
    await Category.deleteMany({});
    console.log('Cleared existing categories');
    await Brand.deleteMany({});
    console.log('Cleared existing brands');
    await Product.deleteMany({});
    console.log('Cleared existing products');

    // Insert sample data
    const categories = await Category.insertMany([
      { name: 'Fruits' },
      { name: 'Vegetables' },
      { name: 'Dairy' },
    ]);
    console.log('Categories seeded:', categories);

    const brands = await Brand.insertMany([
      { name: 'Nestle' },
      { name: 'Amul' },
      { name: 'Dabur' },
    ]);
    console.log('Brands seeded:', brands);

    // Comment out product seeding until a valid vendorId is available
    /*
    const products = await Product.insertMany([
      {
        name: 'Apple',
        description: 'Fresh red apple',
        price: 50,
        images: ['http://example.com/apple.jpg'],
        categoryId: categories[0]._id,
        brandId: brands[0]._id,
        vendorId: 'user123', // Replace with a valid ObjectId (e.g., from an existing User)
        stock: 100,
        unit: 'kg',
        weight: 1,
        nutritionalInfo: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
        expirationDate: new Date('2025-12-01'),
        tags: ['organic', 'fresh'],
        isActive: true,
      },
    ]);
    console.log('Products seeded:', products);
    */

    // Close the connection
    await mongoose.connection.close();
    console.log('Seeding completed and connection closed');
  } catch (err) {
    console.error('Seeding failed:', err);
    await mongoose.connection.close();
    process.exit(1); // Exit with error code
  }
};

seedData();