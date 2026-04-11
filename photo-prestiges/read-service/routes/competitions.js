const express = require("express");
const router = express.Router();
const { db } = require("../services/database");

// GET / — overzicht van alle wedstrijden, filterbaar op city en status (gepagineerd)
router.get("/", async (req, res) => {
  try {
    const { city, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (city) query.city = { $regex: new RegExp(city, "i") };
    if (status) query.status = status;

    const total = await db.collection("competitions").countDocuments(query);
    const data = await db.collection("competitions").find(query).skip(skip).limit(limit).toArray();

    res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch competitions", details: err.message });
  }
});

module.exports = router;
