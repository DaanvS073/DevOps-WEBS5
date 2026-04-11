// Mock http-proxy-middleware zodat er geen echte HTTP calls worden gedaan
jest.mock("http-proxy-middleware", () => ({
  createProxyMiddleware: jest.fn().mockImplementation(() => (req, res) => {
    res.status(200).json({ proxied: true, path: req.path, method: req.method });
  }),
}));

// Mock JWT verificatie
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn().mockReturnValue({ userId: "user1", email: "test@test.com", role: "owner" }),
}));

const request = require("supertest");
const { createProxyMiddleware } = require("http-proxy-middleware");
const app = require("../../app");

beforeEach(() => {
  jest.clearAllMocks();
  // Reset de mock zodat hij telkens een nep-proxy response geeft
  createProxyMiddleware.mockImplementation(() => (req, res) => {
    res.status(200).json({ proxied: true, path: req.path, method: req.method });
  });
});

// ─── Health endpoint ──────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("should return 200 without a token", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});

// ─── Auth routes (publiek — geen JWT) ────────────────────────────────────────

describe("POST /auth/register (public)", () => {
  it("should proxy without JWT and return 200", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@b.com", password: "secret", role: "participant" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });
});

describe("POST /auth/login (public)", () => {
  it("should proxy without JWT and return 200", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@b.com", password: "secret" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });
});

// ─── Beschermde routes — 401 zonder token ────────────────────────────────────

describe("Protected routes — reject without token", () => {
  const protectedRoutes = [
    { method: "get", path: "/targets" },
    { method: "post", path: "/targets" },
    { method: "delete", path: "/targets/abc123" },
    { method: "post", path: "/targets/abc123/submit" },
    { method: "get", path: "/scores/abc123" },
    { method: "get", path: "/competitions" },
    { method: "post", path: "/register/abc123" },
  ];

  protectedRoutes.forEach(({ method, path }) => {
    it(`${method.toUpperCase()} ${path} → 401 zonder token`, async () => {
      const res = await request(app)[method](path);
      expect(res.statusCode).toBe(401);
    });
  });
});

// ─── Beschermde routes — proxy met geldig token ───────────────────────────────

describe("Protected routes — proxy with valid token", () => {
  it("GET /targets → proxied to target-service", async () => {
    const res = await request(app)
      .get("/targets")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("POST /targets → proxied to target-service", async () => {
    const res = await request(app)
      .post("/targets")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("POST /targets/:id/submit → proxied to target-service submissions", async () => {
    const res = await request(app)
      .post("/targets/abc123/submit")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("GET /scores/:targetId → proxied to score-service", async () => {
    const res = await request(app)
      .get("/scores/abc123")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("GET /competitions → proxied to read-service", async () => {
    const res = await request(app)
      .get("/competitions")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("POST /register/:targetId → proxied to register-service", async () => {
    const res = await request(app)
      .post("/register/abc123")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });
});

// ─── Aanvullende route-dekking ────────────────────────────────────────────────

describe("Additional protected routes with valid token", () => {
  it("DELETE /targets/:id → 200 proxied", async () => {
    const res = await request(app)
      .delete("/targets/abc123")
      .set("Authorization", "Bearer valid-token");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("GET /scores/:targetId/my → 200 proxied", async () => {
    const res = await request(app)
      .get("/scores/abc123/my")
      .set("Authorization", "Bearer valid-token");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("GET /register/:targetId → 200 proxied", async () => {
    const res = await request(app)
      .get("/register/abc123")
      .set("Authorization", "Bearer valid-token");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("403 on invalid/expired token", async () => {
    const jwt = require("jsonwebtoken");
    jwt.verify.mockImplementationOnce(() => {
      throw new Error("invalid token");
    });

    const res = await request(app)
      .get("/targets")
      .set("Authorization", "Bearer bad-token");
    expect(res.statusCode).toBe(403);
  });
});

// ─── Role-based authorization ─────────────────────────────────────────────────

describe("Role-based authorization", () => {
  it("POST /targets → 403 for participant role", async () => {
    const jwt = require("jsonwebtoken");
    jwt.verify.mockReturnValueOnce({ userId: "user1", email: "p@test.com", role: "participant" });

    const res = await request(app)
      .post("/targets")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(403);
  });

  it("DELETE /targets/:id → 403 for participant role", async () => {
    const jwt = require("jsonwebtoken");
    jwt.verify.mockReturnValueOnce({ userId: "user1", email: "p@test.com", role: "participant" });

    const res = await request(app)
      .delete("/targets/abc123")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(403);
  });

  it("POST /targets → 200 for owner role", async () => {
    const res = await request(app)
      .post("/targets")
      .set("Authorization", "Bearer valid-token"); // mock retourneert role: "owner"

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });

  it("GET /targets → 200 for participant role (read is allowed)", async () => {
    const jwt = require("jsonwebtoken");
    jwt.verify.mockReturnValueOnce({ userId: "user1", email: "p@test.com", role: "participant" });

    const res = await request(app)
      .get("/targets")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("proxied", true);
  });
});
