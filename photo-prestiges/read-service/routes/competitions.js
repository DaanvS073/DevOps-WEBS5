const express = require("express");
const router = express.Router();
const { db } = require("../services/database");

// GET / — overzicht van alle wedstrijden, filterbaar op city en status
router.get("/", async (req, res) => {
  try {
    const { city, status } = req.query;
    const query = {};

    if (city) {
      query.city = { $regex: new RegExp(city, "i") };
    }

    if (status) {
      query.status = status;
    }

    const competitions = await db.collection("competitions").find(query).toArray();
    res.json(competitions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch competitions", details: err.message });
  }
});

module.exports = router;
