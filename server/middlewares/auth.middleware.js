import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";

export const protect = async (req, res, next) => {
  try {
    // Get token from header
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError("You are not logged in! Please log in to access", 401)
      );
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError("User no longer exists.", 401));
    }

    // Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError("Password changed recently. Please log in again.", 401)
      );
    }

    // Grant access
    req.user = currentUser;
    next();
  } catch (error) {
    return next(new AppError("Invalid token. Please log in again.", 401));
  }
};
