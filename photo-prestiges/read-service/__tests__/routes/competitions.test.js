const request = require("supertest");

jest.mock("../../services/database", () => ({
  db: {
    collection: jest.fn().mockReturnValue({
      find: jest.fn().mockReturnValue({ toArray: jest.fn() }),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
    }),
  },
}));

jest.mock("../../services/rabbitmq", () => ({
  consumeMessages: jest.fn().mockResolvedValue(undefined),
  publishMessage: jest.fn().mockResolvedValue(undefined),
}));

const app = require("../../app");
const { db } = require("../../services/database");

const mockCollection = db.collection();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /competitions", () => {
  it("should return 200 and array of competitions", async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { targetId: "t1", title: "Race Amsterdam", city: "Amsterdam", status: "active" },
        { targetId: "t2", title: "Photo Rotterdam", city: "Rotterdam", status: "active" },
      ]),
    });

    const res = await request(app).get("/competitions");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it("should return 200 with empty array when no competitions", async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app).get("/competitions");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("should pass city filter to query", async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { targetId: "t1", title: "Race Amsterdam", city: "Amsterdam", status: "active" },
      ]),
    });

    const res = await request(app).get("/competitions?city=Amsterdam");

    expect(res.statusCode).toBe(200);
    expect(mockCollection.find).toHaveBeenCalledWith(
      expect.objectContaining({ city: expect.any(Object) })
    );
  });

  it("should pass status filter to query", async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app).get("/competitions?status=finished");

    expect(res.statusCode).toBe(200);
    expect(mockCollection.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: "finished" })
    );
  });
});

describe("consumer handlers", () => {
  const {
    handleTargetCreated,
    handleDeadlineReached,
    handleTargetDeleted,
  } = require("../../services/consumer");

  it("handleTargetCreated should upsert competition", async () => {
    await handleTargetCreated({
      targetId: "t1",
      title: "Test",
      city: "Amsterdam",
      deadline: new Date().toISOString(),
      ownerId: "owner1",
    });

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { targetId: "t1" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "active" }) }),
      { upsert: true }
    );
  });

  it("handleDeadlineReached should set status to finished", async () => {
    await handleDeadlineReached({ targetId: "t1" });

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { targetId: "t1" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "finished" }) })
    );
  });

  it("handleTargetDeleted should remove competition", async () => {
    await handleTargetDeleted({ targetId: "t1" });

    expect(mockCollection.deleteOne).toHaveBeenCalledWith({ targetId: "t1" });
  });
});
