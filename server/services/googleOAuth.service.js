import { google } from "googleapis";
import AppError from "../utils/AppError.js";

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
      throw new AppError("Failed to generate Google Auth URL", 500);
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
        isVerified: data.verified_email || true, // Google accounts are pre-verified
      };
    } catch (error) {
      console.error("Error getting Google user profile:", error);
      throw new AppError("Failed to get Google user profile", 400);
    }
  }

  //   *** Verify Google ID token (alternative method) ***
  async verifyIdToken(idToken) {
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      return {
        googleId: payload["sub"],
        email: payload["email"],
        name: payload["name"],
        avatar: payload["picture"],
        isVerified: payload["email_verified"] || true,
      };
    } catch (error) {
      console.error("Error verifying Google ID token:", error);
      throw new AppError("Invalid Google ID Token", 400);
    }
  }

  //   *** Refresh Google Access Token ***
  async refreshAccessToken(refreshToken) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      console.error("Error Refreshing Google access token:", error);
      throw new AppError("Failed to refresh Google access token", 400);
    }
  }

  //   *** Get User Info using access token ***
  async getUserInfo(accessToken) {
    try {
      const oauth2 = google.oauth2({
        version: "v2",
        auth: this.oauth2Client,
      });
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const { data } = await oauth2.userinfo.get();
      return data;
    } catch (error) {
      console.error("Error getting google user info:", error);
      throw new AppError("Failed to get Google user info", 400);
    }
  }

  //   *** Remove Google Tokens (for account  disconnection) ***
  async revokeTokens(accessToken) {
    try {
      await this.oauth2Client.revokeToken(accessToken);
      return true;
    } catch (error) {
      console.error("Error revoking Google tokens:", error);
      throw new AppError("Failed to revoke Google tokens", 500);
    }
  }

  //   *** Validate Google OAuth configuration ***
  validateConfiguration() {
    const required = ["CLIENT_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new AppError(
        `Missing Google OAuth configuration: ${missing.join(", ")}`,
        500
      );
    }
    return true;
  }

  //   *** Parse Google OAuth error ***
  parseGoogleError(error) {
    if (error.code === "invalid_grant") {
      return "Authorization code has expired or is invalid.";
    }
    if (error.code === "unauthorized_client") {
      return "Invalid Client Credentials.";
    }
    if (error.code === "access_denied") {
      return "User denied access.";
    }
    return error.message || "Google OAuth error occurred.";
  }

  //   *** Generate state parameter for CSRF protection ***
  generateStateParameter() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  //   *** Verify state parameter ***
  verifyStateParameter(receivedState, expectedState) {
    return receivedState === expectedState;
  }

  //   *** Get Google OAuth scopes ***
  getRequiredScopes() {
    return [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ];
  }

  //   *** CHeck if user has required permissions ***
  async checkUserPermissions(accessToken) {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const oauth2 = google.oauth2({
        version: "v2",
        auth: this.oauth2Client,
      });

      const { data } = await oauth2.userinfo.get();

      return {
        hasEmail: !!data.email,
        hasProfile: !!data.name,
        emailVerified: data.verified_email,
      };
    } catch (error) {
      console.error("Error checking user permissions:", error);
      return {
        hasEmail: false,
        hasProfile: false,
        emailVerified: false,
      };
    }
  }
}

export default new GoogleOAuthService();
