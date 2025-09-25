import cors from "cors";

const corsOptions = {
  origin(origin, callback) {
    // Allow access with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.CLIENT_URL || "http://localhost:5173", // Vite default port
      "http://localhost:3000", // React default port
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allow cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
};

export default cors(corsOptions);
