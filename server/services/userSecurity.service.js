import moment from "moment";
import UAParser from "ua-parser-js";
import geoip from "geoip-lite";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";

/**
 * User Security Dashboard Service
 *
 * Simple Explanation:
 * This service hepls users manage their own security settings:
 *  - View their 2FA status and trusted devices
 *  - See their recent login activity with locations
 *  - Manage their security preferences
 *  - Get security recommendations
 *
 * WHY WE NEED THIS:
 *  - Users want control over  their own security
 *  - Transparency builds trust ("show me  what you know  about me")
 *  - Helps users spot suspicious activity
 *  - Industry standard (Github, Google, facebook all have similar features)
 */
