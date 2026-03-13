const mongoose = require('mongoose');
const env = require('./env');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectDB = async () => {
  try {
    let mongoUri = env.MONGO_URI;
    
    if (process.env.USE_MEMORY_SERVER === 'true') {
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log('Using in-memory MongoDB for testing');
    }
    
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const stopMemoryServer = async () => {
  if (mongoServer) {
    await mongoServer.stop();
  }
};

module.exports = connectDB;
module.exports.stopMemoryServer = stopMemoryServer;
