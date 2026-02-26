import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const maxPoolSize = parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host} (poolSize=${maxPoolSize})`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};