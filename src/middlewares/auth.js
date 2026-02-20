// src/middlewares/auth.js
const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ normalize user shape (important!)
    const id = payload.sub || payload.id || payload.userId || payload.uid;
    if (!id) return res.status(401).json({ error: "Invalid token (missing user id)" });

    req.user = {
      ...payload,
      id: String(id), // ✅ always present
    };

    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}

module.exports = { auth, requireRole };