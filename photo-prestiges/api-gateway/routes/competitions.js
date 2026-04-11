const express = require("express");
const router = express.Router();
const { db } = require("../services/database");

// GET / — alle actieve wedstrijden
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.query.city) {
      query.city = req.query.city;
    }
    const competitions = await db.collection("targets").find(query).toArray();
    res.json(competitions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch competitions", details: err.message });
  }
});

module.exports = router;
