const request = require("supertest");
const app = require("../../app");

// Mock de database en rabbitmq services
jest.mock("../../services/database", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { _id: "1", title: "Test Target", city: "Amsterdam" },
        ]),
      }),
      insertOne: jest.fn().mockResolvedValue({ insertedId: "abc123" }),
    }),
  },
}));

jest.mock("../../services/rabbitmq", () => ({
  publishMessage: jest.fn().mockResolvedValue(undefined),
}));

// Mock JWT verification voor POST tests
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn().mockReturnValue({ userId: "user1", email: "test@test.com", role: "owner" }),
}));

describe("GET /targets", () => {
  it("should return 200 and an array of targets", async () => {
    const res = await request(app).get("/targets");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /targets", () => {
  it("should return 201 with valid data and auth token", async () => {
    const res = await request(app)
      .post("/targets")
      .set("Authorization", "Bearer valid-token")
      .send({
        title: "New Target",
        description: "A test target",
        city: "Rotterdam",
        deadline: new Date().toISOString(),
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("title", "New Target");
  });

  it("should return 401 without auth token", async () => {
    const res = await request(app)
      .post("/targets")
      .send({ title: "No Auth Target", city: "Utrecht" });
    expect(res.statusCode).toBe(401);
  });

  it("should return 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/targets")
      .set("Authorization", "Bearer valid-token")
      .send({ description: "Missing title and city" });
    expect(res.statusCode).toBe(400);
  });
});
