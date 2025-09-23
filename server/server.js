import "./configs/dotenv.config.js"; // Load environment variables first from config.js
import app from "./app.js";
import connectDB from "./configs/db.config.js";

// Catching Uncaught Exceptions
process.on("uncaughtException", (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Connect to Database
connectDB();

// Start Express server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error(`Unhandled Rejection at: ${promise}. Reason: ${reason}`);
  server.close(() => process.exit(1));
});
