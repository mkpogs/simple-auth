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

  //   ***  ***
}

export default new GoogleOAuthService();
