// Mock SendGrid voor alle tests
jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

// Mock mailer voor consumer-tests — consumer importeert destructured,
// dus jest.mock zorgt dat de consumer de mock krijgt
jest.mock("../../services/mailer", () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

const sgMail = require("@sendgrid/mail");
const mailerMock = require("../../services/mailer");

// De echte implementatie voor unit tests op sendMail zelf
const { sendMail: realSendMail } = jest.requireActual("../../services/mailer");

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Unit tests op de echte sendMail implementatie ───────────────────────────

describe("sendMail (real implementation)", () => {
  describe("development mode", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should NOT call sgMail.send in development mode", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await realSendMail("test@example.com", "Test Subject", "<p>Test</p>");

      expect(sgMail.send).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should log mail details to console in development mode", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await realSendMail("user@example.com", "Hello", "<b>World</b>");

      const calls = consoleSpy.mock.calls.flat().join(" ");
      expect(calls).toContain("user@example.com");
      expect(calls).toContain("Hello");

      consoleSpy.mockRestore();
    });
  });

  describe("production mode", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    afterEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should call sgMail.send in production mode", async () => {
      await realSendMail("prod@example.com", "Prod Subject", "<p>Prod body</p>");

      expect(sgMail.send).toHaveBeenCalledTimes(1);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "prod@example.com",
          subject: "Prod Subject",
          html: "<p>Prod body</p>",
        })
      );
    });

    it("should use FROM_EMAIL env var as sender", async () => {
      process.env.FROM_EMAIL = "custom@photo-prestiges.com";

      await realSendMail("user@example.com", "Subject", "<p>body</p>");

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({ from: "custom@photo-prestiges.com" })
      );
    });
  });
});

// ─── Consumer handler tests (gebruikt gemockte sendMail) ─────────────────────

describe("consumer handlers", () => {
  const {
    handleUserRegistered,
    handleDeadlineReminder,
    handleWinnerDetermined,
    handleScoreCalculated,
  } = require("../../services/consumer");

  beforeEach(() => {
    mailerMock.sendMail.mockClear();
  });

  it("handleUserRegistered should call sendMail once", async () => {
    await handleUserRegistered({ email: "new@user.com", role: "participant" });

    expect(mailerMock.sendMail).toHaveBeenCalledTimes(1);
    expect(mailerMock.sendMail).toHaveBeenCalledWith(
      "new@user.com",
      expect.stringContaining("Welkom"),
      expect.stringContaining("participant")
    );
  });

  it("handleDeadlineReminder should send mail to each participant", async () => {
    await handleDeadlineReminder({
      targetId: "t1",
      label: "30m",
      participantEmails: ["a@test.com", "b@test.com"],
    });

    expect(mailerMock.sendMail).toHaveBeenCalledTimes(2);
  });

  it("handleDeadlineReminder should skip when no participants", async () => {
    await handleDeadlineReminder({ targetId: "t1", label: "10m", participantEmails: [] });
    expect(mailerMock.sendMail).not.toHaveBeenCalled();
  });

  it("handleScoreCalculated should skip when no userEmail provided", async () => {
    await handleScoreCalculated({ targetId: "t1", userId: "u1", score: 75.5 });
    expect(mailerMock.sendMail).not.toHaveBeenCalled();
  });

  it("handleScoreCalculated should call sendMail when userEmail provided", async () => {
    await handleScoreCalculated({
      targetId: "t1",
      userId: "u1",
      score: 75.5,
      userEmail: "player@test.com",
    });

    expect(mailerMock.sendMail).toHaveBeenCalledTimes(1);
    expect(mailerMock.sendMail).toHaveBeenCalledWith(
      "player@test.com",
      expect.stringContaining("t1"),
      expect.stringContaining("75.50")
    );
  });

  it("handleWinnerDetermined should mail owner and all participants", async () => {
    await handleWinnerDetermined({
      targetId: "t1",
      winnerId: "u1",
      scores: [
        { userId: "u1", score: 90 },
        { userId: "u2", score: 70 },
      ],
      ownerEmail: "owner@test.com",
      participantEmails: { u1: "u1@test.com", u2: "u2@test.com" },
    });

    // 1 owner mail + 2 deelnemer mails
    expect(mailerMock.sendMail).toHaveBeenCalledTimes(3);
  });
});
