import jwtService from "./jwt.service.js";
import emailService from "./email.service.js";
import otpService from "./otp.service.js";
import googleOAuthService from "./googleOAuth.service.js";

export { jwtService, emailService, otpService, googleOAuthService };

// Default export for convenience
export default {
  jwt: jwtService,
  email: emailService,
  otp: otpService,
  googleOAuth: googleOAuthService,
};
