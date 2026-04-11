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

// POST /:targetId — foto inzenden voor een target
router.post("/:targetId", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { targetId } = req.params;

    const target = await db.collection("targets").findOne({ _id: new ObjectId(targetId) });
    if (!target) {
      return res.status(404).json({ error: "Target not found" });
    }

    if (new Date() > new Date(target.deadline)) {
      return res.status(400).json({ error: "Deadline has passed for this target" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const imageUrl = `/images/${req.file.filename}`;
    const submissionId = uuidv4();

    const submission = {
      submissionId,
      targetId,
      userId: req.user.userId,
      imageUrl,
      createdAt: new Date(),
    };

    await db.collection("submissions").insertOne(submission);

    await publishMessage("submission-received", {
      targetId,
      submissionId,
      userId: req.user.userId,
      imageUrl,
    });

    res.status(201).json(submission);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit", details: err.message });
  }
});

// DELETE /:id — eigen inzending verwijderen
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const submission = await db.collection("submissions").findOne({ submissionId: req.params.id });

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (submission.userId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ error: "You can only delete your own submissions" });
    }

    await db.collection("submissions").deleteOne({ submissionId: req.params.id });

    res.json({ message: "Submission deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete submission", details: err.message });
  }
});

// GET /:targetId — alle submissions voor een target (gepagineerd)
router.get("/:targetId", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = { targetId: req.params.targetId };

    const total = await db.collection("submissions").countDocuments(filter);
    const data = await db.collection("submissions").find(filter).skip(skip).limit(limit).toArray();

    res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch submissions", details: err.message });
  }
});

module.exports = router;
