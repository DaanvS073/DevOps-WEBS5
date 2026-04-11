const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { db } = require("../services/database");

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "development-secret-key");
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// POST /:targetId — deelnemer schrijft zich in voor een wedstrijd
router.post("/:targetId", verifyToken, async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user.userId;

    // Check of inschrijving nog open is
    const existing = await db
      .collection("registrations")
      .findOne({ targetId, userId: String(userId) });

    if (existing) {
      return res.status(409).json({ error: "Already registered for this target" });
    }

    // Check of inschrijving gesloten is
    const closed = await db
      .collection("registrations")
      .findOne({ targetId, open: false });

    if (closed) {
      return res.status(400).json({ error: "Registration is closed for this target" });
    }

    const registration = {
      targetId,
      userId: String(userId),
      open: true,
      registeredAt: new Date(),
    };

    const result = await db.collection("registrations").insertOne(registration);

    res.status(201).json({ ...registration, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: "Registration failed", details: err.message });
  }
});

// GET /:targetId — alle inschreven deelnemers voor een target (gepagineerd)
router.get("/:targetId", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = { targetId: req.params.targetId };

    const total = await db.collection("registrations").countDocuments(filter);
    const data = await db.collection("registrations").find(filter).skip(skip).limit(limit).toArray();

    res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch registrations", details: err.message });
  }
});

module.exports = router;
