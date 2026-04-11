const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const { ObjectId } = require("mongodb");
const { db } = require("../services/database");
const { publishMessage } = require("../services/rabbitmq");
const verifyToken = require("../middleware/auth");

// Multer opslag configuratie
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage });

// GET / — alle targets, filterbaar op city en coördinaten, met paginering
router.get("/", async (req, res) => {
  try {
    const { city, latitude, longitude, radius } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (city) {
      query.city = { $regex: new RegExp(city, "i") };
    }

    // Filter op coördinaten/radius — doe in-memory na ophalen (geen geo-index)
    if (latitude && longitude && radius) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const r = parseFloat(radius);

      const allTargets = await db.collection("targets").find(query).toArray();
      const filtered = allTargets.filter((t) => {
        if (!t.latitude || !t.longitude) return false;
        const dLat = t.latitude - lat;
        const dLng = t.longitude - lng;
        return Math.sqrt(dLat * dLat + dLng * dLng) <= r;
      });

      const total = filtered.length;
      const data = filtered.slice(skip, skip + limit);
      return res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
    }

    const total = await db.collection("targets").countDocuments(query);
    const data = await db.collection("targets").find(query).skip(skip).limit(limit).toArray();

    res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch targets", details: err.message });
  }
});

// GET /:id — specifieke target
router.get("/:id", async (req, res) => {
  try {
    const target = await db.collection("targets").findOne({ _id: new ObjectId(req.params.id) });
    if (!target) {
      return res.status(404).json({ error: "Target not found" });
    }
    res.json(target);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch target", details: err.message });
  }
});

// POST / — nieuwe target aanmaken (multipart/form-data)
router.post("/", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { title, description, city, latitude, longitude, radius, deadline, ownerId } = req.body;

    if (!title || !city || !deadline) {
      return res.status(400).json({ error: "title, city and deadline are required" });
    }

    const imageUrl = req.file
      ? `/images/${req.file.filename}`
      : null;

    const target = {
      title,
      description: description || "",
      city,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radius: radius ? parseFloat(radius) : null,
      deadline: new Date(deadline),
      ownerId: ownerId || req.user.userId,
      imageUrl,
      createdAt: new Date(),
    };

    const result = await db.collection("targets").insertOne(target);
    const created = { ...target, _id: result.insertedId };

    await publishMessage("target-created", {
      targetId: result.insertedId,
      title,
      city,
      deadline: target.deadline,
      ownerId: target.ownerId,
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create target", details: err.message });
  }
});

// DELETE /:id — target verwijderen (alleen owner)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const target = await db.collection("targets").findOne({ _id: new ObjectId(req.params.id) });

    if (!target) {
      return res.status(404).json({ error: "Target not found" });
    }

    if (target.ownerId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ error: "Only the owner can delete this target" });
    }

    await db.collection("targets").deleteOne({ _id: new ObjectId(req.params.id) });
    await db.collection("submissions").deleteMany({ targetId: req.params.id });

    await publishMessage("target-deleted", { targetId: req.params.id });

    res.json({ message: "Target deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete target", details: err.message });
  }
});

module.exports = router;
