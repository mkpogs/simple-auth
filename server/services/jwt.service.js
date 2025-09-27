import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN;

class JWTService {
  // *** Generate Access Token (short-lived) ***
  generateAccessToken(payload) {
    try {
      return jwt.sign(payload, JWT_ACCESS_SECRET, {
        expiresIn: JWT_ACCESS_EXPIRES_IN || "15m",
      });
    } catch (error) {
      throw new AppError("Failed to generate access token", 500);
    }
  }

  // *** Generate Refresh Token (long-lived) ***
  generateRefreshToken(payload) {
    try {
      return jwt.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN || "7d",
      });
    } catch (error) {
      throw new AppError("Failed to generate refresh token", 500);
    }
  }

  // *** Verify Access Token ***
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, JWT_ACCESS_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new AppError("Access token expired", 401);
      } else if (error.name === "JsonWebTokenError") {
        throw new AppError("Invalid access token", 401);
      }
      throw new AppError("Token verification failed", 401);
    }
  }

  // *** Verify Refresh Token ***
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new AppError("Refresh token has expired", 401);
      } else if (error.name === "JsonWebTokenError") {
        throw new AppError("Invalid refresh token", 401);
      }
      throw new AppError("Token verification failed", 401);
    }
  }

  // *** ***
}

export default new JWTService();
