const User = require("../models/account");

module.exports = async (req, res, next) => {
  try {
    // Public paths don't need any auth processing
    const publicPaths = ["/login", "/signup", "/error"];
    if (publicPaths.includes(req.path)) return next();

    // Try to attach user if session exists
    if (req.session?.userId) {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user; // Attach user if found
      } else {
        // Clear invalid session
        req.session.destroy();
      }
    }

    next(); // Always continue to the route
  } catch (err) {
    console.error("Auth middleware error:", err);
    next(); // Still continue even if auth fails
  }
};
