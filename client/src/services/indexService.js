/**
 * Service Barrel Export
 *
 * WHAT IT DOES:
 *  - Centralizes all service imports
 *  - Makes importing services cleaner
 *  - Easy to add new services
 *
 * USAGE:
 * import {authService, userService} from '../services';
 */

export { authService } from "./authService";
export { userService } from "./userService";
export { twoFactorService } from "./twoFactorService";
export { adminService } from "./adminService";

// You can also create grouped exports if needed
export const services = {
  auth: authService,
  user: userService,
  twoFactor: twoFactorService,
  admin: adminService,
};
