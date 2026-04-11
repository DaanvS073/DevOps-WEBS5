const express = require("express");
const router = express.Router();
const { db } = require("../services/database");
const { publishMessage } = require("../services/rabbitmq");
const verifyToken = require("../middleware/auth");

// GET / — alle targets ophalen, optionele filters: city, coordinates, radius
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.query.city) {
      query.city = req.query.city;
    }
    const targets = await db.collection("targets").find(query).toArray();
    res.json(targets);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch targets", details: err.message });
  }
});

// POST / — nieuwe target aanmaken (auth vereist)
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, description, city, coordinates, radius, deadline, ownerId, imageUrl } = req.body;

    if (!title || !city) {
      return res.status(400).json({ error: "title and city are required" });
    }

    const target = {
      title,
      description,
      city,
      coordinates,
      radius,
      deadline,
      ownerId: ownerId || req.user.userId,
      imageUrl,
      createdAt: new Date(),
    };

    const result = await db.collection("targets").insertOne(target);
    const created = { ...target, _id: result.insertedId };

    await publishMessage("target-created", created);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create target", details: err.message });
  }
});

module.exports = router;
