const request = require("supertest");

jest.mock("../../services/database", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      findOne: jest.fn(),
      insertOne: jest.fn(),
      find: jest.fn().mockReturnValue({ toArray: jest.fn() }),
      updateMany: jest.fn(),
    }),
  },
}));

jest.mock("../../services/rabbitmq", () => ({
  consumeMessages: jest.fn().mockResolvedValue(undefined),
  publishMessage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn().mockReturnValue({ userId: "user123", email: "user@test.com", role: "participant" }),
}));

const app = require("../../app");
const { db } = require("../../services/database");

const mockCollection = db.collection();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /registrations/:targetId", () => {
  it("should return 201 when registration succeeds", async () => {
    mockCollection.findOne.mockResolvedValue(null); // geen bestaande registratie, niet gesloten
    mockCollection.insertOne.mockResolvedValue({ insertedId: "reg123" });

    const res = await request(app)
      .post("/registrations/target-abc")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("targetId", "target-abc");
    expect(res.body).toHaveProperty("userId", "user123");
    expect(res.body).toHaveProperty("open", true);
  });

  it("should return 409 when already registered", async () => {
    mockCollection.findOne.mockResolvedValueOnce({ targetId: "target-abc", userId: "user123" });

    const res = await request(app)
      .post("/registrations/target-abc")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(409);
  });

  it("should return 400 when registration is closed", async () => {
    // Eerste findOne: geen bestaande registratie
    // Tweede findOne: gesloten registratie gevonden
    mockCollection.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ targetId: "target-abc", open: false });

    const res = await request(app)
      .post("/registrations/target-abc")
      .set("Authorization", "Bearer valid-token");

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/closed/i);
  });

  it("should return 401 when no token provided", async () => {
    const res = await request(app).post("/registrations/target-abc");
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /registrations/:targetId", () => {
  it("should return 200 and array of registrations", async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { targetId: "target-abc", userId: "user1", open: true },
        { targetId: "target-abc", userId: "user2", open: true },
      ]),
    });

    const res = await request(app).get("/registrations/target-abc");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it("should return 200 with empty array when no registrations", async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app).get("/registrations/target-xyz");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});
