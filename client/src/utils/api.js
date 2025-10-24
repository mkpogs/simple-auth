import axios from "axios";
import toast from "react-hot-toast";

/**
 * API Client Configuration
 *
 * WHAT IT DOES:
 *  - Creates a configured axios instance
 *  - Automatically adds auth tokens to requests
 *  - Handles common errors (401, 403, 500)
 *  - Shows user-friendly error messages
 *
 * WHY WE NEED IT:
 *  - Centralized HTTP configuration
 *  - Automatic token management
 *  - Consistent error handling
 *  - Easy to modify API behavior
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const NODE_ENV = import.meta.env.VITE_NODE_ENV || "development";

// *** Create axios instance with base configuration ***
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// *** Request Interceptor - Runs BEFORE every API call ***
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("accessToken");

    if (token) {
      // Add token to Authorization header
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log API calls in development
    if (NODE_ENV === "development") {
      console.log(`🔄 API Call: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error("❌ Request error:", error);
    return Promise.reject(error);
  }
);
