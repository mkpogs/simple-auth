import { google } from "googleapis";
import AppError from "../utils/appError.util.js";

const CLIENT_URL = process.env.CLIENT_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URL = `${CLIENT_URL}/auth/google/callback`;

class GoogleOAuthService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URL
    );
  }

  //   *** Generate Google OAuth URL ***
  generateAuthUrl() {
    try {
      const scopes = [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ];

      const authURL = this.oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
      });

      return authURL;
    } catch (error) {
      console.error(`Error generating Google OAuth URL:`, error);
      throw new AppError("", 500);
    }
  }

  //   *** Get user profile from Google using authorization code ***
  async getUserProfile(code) {
    try {
      // Exchange authorization code for access token
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Fetch user profile information
      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: "v2",
      });

      const { data } = await oauth2.userinfo.get();

      return {
        googleId: data.id,
        email: data.email,
        name: data.name,
        avatar: data.picture,
        isVerfied: data.verified_email || true, // Google accounts are pre-verified
      };
    } catch (error) {
      console.error("Error getting Google user profile:", error);
      throw new AppError("Failed to get Google user profile", 500);
    }
  }

  //   ***  ***
  // Fn() {
  //   try{

  //   } catch (error) {
  //     console.error();
  //     throw new AppError('', 500);
  //   }
  // }

  //   ***  ***

  //   ***  ***

  //   ***  ***

  //   ***  ***
}

export default new GoogleOAuthService();
