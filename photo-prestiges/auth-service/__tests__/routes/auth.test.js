const request = require("supertest");
const bcrypt = require("bcryptjs");

// Mock database — factory mag geen externe variabelen gebruiken door hoisting
jest.mock("../../services/database", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      findOne: jest.fn(),
      insertOne: jest.fn(),
    }),
  },
}));

// Mock rabbitmq
jest.mock("../../services/rabbitmq", () => ({
  publishMessage: jest.fn().mockResolvedValue(undefined),
}));

const app = require("../../app");
const { db } = require("../../services/database");

// Haal de gemockte functies op na require
const mockCollection = db.collection();
const mockFindOne = mockCollection.findOne;
const mockInsertOne = mockCollection.insertOne;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /auth/register", () => {
  it("should return 201 and create user in DB", async () => {
    mockFindOne.mockResolvedValue(null); // geen bestaande user
    mockInsertOne.mockResolvedValue({ insertedId: "newUserId123" });

    const res = await request(app).post("/auth/register").send({
      email: "test@example.com",
      password: "password123",
      role: "participant",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("userId");
    expect(res.body).toHaveProperty("email", "test@example.com");
    expect(res.body).toHaveProperty("role", "participant");
    expect(mockInsertOne).toHaveBeenCalledTimes(1);
  });

  it("should return 409 when email already exists", async () => {
    mockFindOne.mockResolvedValue({ email: "test@example.com" });

    const res = await request(app).post("/auth/register").send({
      email: "test@example.com",
      password: "password123",
      role: "participant",
    });

    expect(res.statusCode).toBe(409);
  });

  it("should return 400 when required fields are missing", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "test@example.com",
    });

    expect(res.statusCode).toBe(400);
  });

  it("should return 400 for invalid role", async () => {
    mockFindOne.mockResolvedValue(null);

    const res = await request(app).post("/auth/register").send({
      email: "test@example.com",
      password: "password123",
      role: "admin",
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("should return 200 with JWT token on correct credentials", async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    mockFindOne.mockResolvedValue({
      _id: "userId123",
      email: "test@example.com",
      password: hashedPassword,
      role: "participant",
    });

    const res = await request(app).post("/auth/login").send({
      email: "test@example.com",
      password: "password123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("should return 401 when user does not exist", async () => {
    mockFindOne.mockResolvedValue(null);

    const res = await request(app).post("/auth/login").send({
      email: "unknown@example.com",
      password: "password123",
    });

    expect(res.statusCode).toBe(401);
  });

  it("should return 401 on wrong password", async () => {
    const hashedPassword = await bcrypt.hash("correctpassword", 10);
    mockFindOne.mockResolvedValue({
      _id: "userId123",
      email: "test@example.com",
      password: hashedPassword,
      role: "participant",
    });

    const res = await request(app).post("/auth/login").send({
      email: "test@example.com",
      password: "wrongpassword",
    });

    expect(res.statusCode).toBe(401);
  });
});
