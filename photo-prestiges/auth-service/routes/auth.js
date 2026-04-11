const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../services/database");
const { publishMessage } = require("../services/rabbitmq");

// POST /register — nieuwe gebruiker registreren
router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: "email, password and role are required" });
    }

    if (!["participant", "owner"].includes(role)) {
      return res.status(400).json({ error: "role must be 'participant' or 'owner'" });
    }

    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      email,
      password: hashedPassword,
      role,
      createdAt: new Date(),
    };

    const result = await db.collection("users").insertOne(user);

    await publishMessage("user-registered", { email, role });

    res.status(201).json({ userId: result.insertedId, email, role });
  } catch (err) {
    res.status(500).json({ error: "Registration failed", details: err.message });
  }
});

// POST /login — inloggen en JWT token ontvangen
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "development-secret-key",
      { expiresIn: "24h" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

module.exports = router;
