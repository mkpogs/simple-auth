import mongoose from "mongoose";

const connectDB = async () => {
  const DATABASE = process.env.DATABASE;
  const DB_PASSWORD = process.env.DATABASE_PASSWORD;

  // Validate Required Environment Variables
  if (!DATABASE || !DB_PASSWORD) {
    console.error("❌ Missing required environment variables.");
    console.error("DATABASE:", DATABASE ? "✅ Found" : "❌ Missing");
    console.error("DB_PASSWORD:", DB_PASSWORD ? "✅ Found" : "❌ Missing");
    process.exit(1);
  }

  // Replace <PASSWORD> in the MongoDB URI
  const DB = DATABASE.replace("<db_password>", DB_PASSWORD);

  // Connect to MongoDB
  try {
    await mongoose.connect(DB);
    console.log(`✅ DB connection successful!`);
  } catch (err) {
    console.error(`❌ DB connection error: ${err.message}`);
    process.exit(1);
  }

  // Enable Mongoose debugging based on environment variable
  const isDebugMode = process.env.MONGO_DEBUG === "true";
  mongoose.set("debug", isDebugMode);
  if (isDebugMode) console.log(`'🛠️  Mongoose Debug Mode Enabled'`);

  //   Listen for MongoDB connection Events
  mongoose.connection
    .once("connected", () => console.log(`✅ MongoDB connected Successfully`))
    .on("error", (err) =>
      console.error(`❌ MongoDB connection error: ${err.message}`)
    )
    .on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected! Attempting to reconnect...");
      mongoose
        .connect(DB)
        .catch((err) =>
          console.error(`🔄 Reconnection attempt failed: ${err.message}`)
        );
    });
};

export default connectDB;
