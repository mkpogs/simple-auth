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

  // *** ***
}

export default new JWTService();
