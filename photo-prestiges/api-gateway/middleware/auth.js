const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "development-secret-key");
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware factory voor role-based authorization.
 * Gebruik na verifyToken: requireRole("owner")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No token provided" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Toegang geweigerd. Vereiste rol: ${roles.join(" of ")}`,
      });
    }
    next();
  };
}

module.exports = verifyToken;
module.exports.requireRole = requireRole;
