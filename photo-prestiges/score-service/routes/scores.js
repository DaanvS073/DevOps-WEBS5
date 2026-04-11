const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { db } = require("../services/database");

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

// GET /:targetId — alle scores voor een target
router.get("/:targetId", async (req, res) => {
  try {
    const scores = await db
      .collection("scores")
      .find({ targetId: req.params.targetId })
      .toArray();

    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scores", details: err.message });
  }
});

// GET /:targetId/my — eigen score voor een target (JWT vereist)
router.get("/:targetId/my", verifyToken, async (req, res) => {
  try {
    const score = await db.collection("scores").findOne({
      targetId: req.params.targetId,
      userId: req.user.userId,
    });

    if (!score) {
      return res.status(404).json({ error: "No score found for this target" });
    }

    res.json(score);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch score", details: err.message });
  }
});

module.exports = router;
