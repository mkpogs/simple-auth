import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { required } from "joi";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      maxlength: [50, "Name must be less than 50 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address.",
      ],
    },
    password: {
      type: String,
      required: function () {
        // Password is required ONLY IF user doesn't have googleID not OAuth user
        return !this.googleId;
      },
      minlength: [8, "Password must be at least 8 characters."],
      select: false, // Do not return password field by default in queries
    },

    // *** Email Verification ***
    isVerified: {
      type: Boolean,
      default: false,
    },
    otpCode: {
      type: String,
      select: false, // Do not return otpCode field by default in queries
    },
    otpExpiresAt: {
      type: Date,
      select: false, // Do not return otpExpiresAt field by default in queries
    },

    // *** Password Management ***
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    passwordExpiresAt: {
      type: Date,
      default: function () {
        // Set default password expiry to 90 days from creation
        const expiryDate = new Date();
        expiryDate.setDate(
          expiryDate.getDate() + (process.env.PASSWORD_EXPIRY_DAYS || 90)
        );
        return expiryDate;
      },
    },

    // *** Password Reset System ***
    resetPasswordToken: {
      type: String,
      select: false, // Do not return resetPasswordToken field by default in queries
    },
    resetPasswordExpires: {
      type: Date,
      select: false, // Do not return resetPasswordExpires field by default in queries
    },

    // *** JWT Token Management ***
    refreshTokens: [
      {
        token: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // *** OAuth Integration (Google) ***
    googleId: {
      type: String,
      spars: true, // Allows multiple null values but unique non-null values
    },
    avatar: {
      type: String, // URL to the user's avatar image
    },

    // *** Account Management ***
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
// Improve query performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ "refreshTokens.token": 1 });

// ==================== VIRTUALS ====================
// Virtual field to check if password is expired
userSchema.virtual("isPasswordExpired").get(() => {
  return this.passwordExpiresAt < new Date();
});

// ==================== MIDDLEWARES ====================
// *** Hash password before saving ***
userSchema.pre("save", async (next) => {
  // Only hash the password if it's been modified (or is new)
  if (!this.isModified("password")) return next();

  // Don't hash if password is not provided (OAuth users)
  if (!this.password) return next();

  try {
    // Hash the password with a cost of 12
    this.password = await bcrypt.hash(this.password, 12);

    // Update password  change timestamp
    this.passwordChangedAt = new Date();

    // Set new password expiry date
    const expiryDate = new Date();
    expiryDate.setDate(
      expiryDate.getDate() + (process.env.PASSWORD_EXPIRY_DAYS || 90)
    );
    this.passwordExpiresAt = expiryDate;
    next();
  } catch (err) {
    return next(err);
  }
});

// *** Update lastLogin before saving ***
userSchema.pre("save", (next) => {
  if (this.isModified("lastLogin")) {
    this.lastLogin = new Date();
  }
  next();
});

// Create the Model
const User = mongoose.model("User", userSchema);
export default User;
