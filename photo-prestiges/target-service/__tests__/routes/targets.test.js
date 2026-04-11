const request = require("supertest");
const path = require("path");
const fs = require("fs");

// Mock database — inclusief countDocuments en chained skip/limit
const mockChain = {
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  toArray: jest.fn(),
};

jest.mock("../../services/database", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      find: jest.fn().mockReturnValue(mockChain),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      countDocuments: jest.fn(),
    }),
  },
}));

// Mock rabbitmq
jest.mock("../../services/rabbitmq", () => ({
  publishMessage: jest.fn().mockResolvedValue(undefined),
}));

// Mock JWT verificatie
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn().mockReturnValue({ userId: "owner123", email: "owner@test.com", role: "owner" }),
  sign: jest.fn().mockReturnValue("mocked-token"),
}));

const app = require("../../app");
const { db } = require("../../services/database");

const mockCollection = db.collection();

beforeEach(() => {
  jest.clearAllMocks();
  mockChain.skip.mockReturnThis();
  mockChain.limit.mockReturnThis();
  mockChain.sort.mockReturnThis();
});

describe("GET /targets", () => {
  it("should return 200 and a paginated result with data array", async () => {
    const items = [
      { _id: "id1", title: "Target 1", city: "Amsterdam" },
      { _id: "id2", title: "Target 2", city: "Rotterdam" },
    ];
    mockCollection.countDocuments.mockResolvedValue(2);
    mockChain.toArray.mockResolvedValue(items);

    const res = await request(app).get("/targets");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body).toHaveProperty("total", 2);
    expect(res.body).toHaveProperty("page", 1);
    expect(res.body).toHaveProperty("limit", 20);
  });

  it("should return 200 with empty data array when no targets", async () => {
    mockCollection.countDocuments.mockResolvedValue(0);
    mockChain.toArray.mockResolvedValue([]);

    const res = await request(app).get("/targets");

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe("POST /targets", () => {
  it("should return 201 and create a target", async () => {
    mockCollection.insertOne.mockResolvedValue({ insertedId: "newTargetId" });

    // Maak een tijdelijk testbestand
    const tmpFile = path.join(__dirname, "test-image.jpg");
    fs.writeFileSync(tmpFile, "fake image content");

    const res = await request(app)
      .post("/targets")
      .set("Authorization", "Bearer valid-token")
      .field("title", "Test Target")
      .field("city", "Amsterdam")
      .field("deadline", new Date(Date.now() + 86400000).toISOString())
      .attach("image", tmpFile);

    fs.unlinkSync(tmpFile);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("title", "Test Target");
    expect(res.body).toHaveProperty("city", "Amsterdam");
  });

  it("should return 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/targets")
      .set("Authorization", "Bearer valid-token")
      .send({ title: "Missing fields" });

    expect(res.statusCode).toBe(400);
  });

  it("should return 401 when no token provided", async () => {
    const res = await request(app).post("/targets").send({
      title: "Test",
      city: "Amsterdam",
      deadline: new Date().toISOString(),
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /submissions/:targetId", () => {
  it("should return 201 when submitting a photo", async () => {
    const futureDeadline = new Date(Date.now() + 86400000);
    mockCollection.findOne.mockResolvedValue({
      _id: "targetId123",
      title: "Test Target",
      deadline: futureDeadline,
    });
    mockCollection.insertOne.mockResolvedValue({ insertedId: "submissionId" });

    const tmpFile = path.join(__dirname, "submission-image.jpg");
    fs.writeFileSync(tmpFile, "fake submission image");

    const res = await request(app)
      .post("/submissions/507f1f77bcf86cd799439011")
      .set("Authorization", "Bearer valid-token")
      .attach("image", tmpFile);

    fs.unlinkSync(tmpFile);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("imageUrl");
    expect(res.body).toHaveProperty("targetId");
  });

  it("should return 400 when deadline has passed", async () => {
    const pastDeadline = new Date(Date.now() - 86400000);
    mockCollection.findOne.mockResolvedValue({
      _id: "targetId123",
      title: "Expired Target",
      deadline: pastDeadline,
    });

    const tmpFile = path.join(__dirname, "submission-image2.jpg");
    fs.writeFileSync(tmpFile, "fake image");

    const res = await request(app)
      .post("/submissions/507f1f77bcf86cd799439011")
      .set("Authorization", "Bearer valid-token")
      .attach("image", tmpFile);

    fs.unlinkSync(tmpFile);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/deadline/i);
  });
});
