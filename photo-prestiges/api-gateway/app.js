const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");

const verifyToken = require("./middleware/auth");
const healthRouter = require("./routes/health");

const app = express();

app.use(cors());
app.use(morgan("dev"));

// Service URLs (ingesteld via environment variabelen)
const AUTH_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const TARGET_URL = process.env.TARGET_SERVICE_URL || "http://localhost:3002";
const SCORE_URL = process.env.SCORE_SERVICE_URL || "http://localhost:3003";
const REGISTER_URL = process.env.REGISTER_SERVICE_URL || "http://localhost:3005";
const READ_URL = process.env.READ_SERVICE_URL || "http://localhost:3006";

// ─── Publieke routes (geen JWT vereist) ──────────────────────────────────────

app.use("/health", healthRouter);

app.use(
  "/auth",
  createProxyMiddleware({
    target: AUTH_URL,
    changeOrigin: true,
  })
);

// ─── Beschermde routes (JWT vereist) ─────────────────────────────────────────

// POST /targets/:id/submit → target-service /submissions/:id
// Moet vóór de generieke /targets proxy staan
app.post(
  "/targets/:id/submit",
  verifyToken,
  createProxyMiddleware({
    target: TARGET_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => `/submissions/${req.params.id}`,
  })
);

// /targets/** → target-service
app.use(
  "/targets",
  verifyToken,
  createProxyMiddleware({
    target: TARGET_URL,
    changeOrigin: true,
  })
);

// /scores/** → score-service
app.use(
  "/scores",
  verifyToken,
  createProxyMiddleware({
    target: SCORE_URL,
    changeOrigin: true,
  })
);

// /competitions → read-service
app.use(
  "/competitions",
  verifyToken,
  createProxyMiddleware({
    target: READ_URL,
    changeOrigin: true,
  })
);

// /register/:targetId → register-service /registrations/:targetId
app.use(
  "/register",
  verifyToken,
  createProxyMiddleware({
    target: REGISTER_URL,
    changeOrigin: true,
    pathRewrite: { "^/register": "/registrations" },
  })
);

module.exports = app;
