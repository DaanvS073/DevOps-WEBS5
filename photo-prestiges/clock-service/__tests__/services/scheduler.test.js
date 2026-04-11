const { isDeadlinePassed, getPendingReminders } = require("../../services/scheduler");

describe("isDeadlinePassed", () => {
  it("should return true when deadline is in the past", () => {
    const past = new Date(Date.now() - 10000);
    expect(isDeadlinePassed(past)).toBe(true);
  });

  it("should return false when deadline is in the future", () => {
    const future = new Date(Date.now() + 10000);
    expect(isDeadlinePassed(future)).toBe(false);
  });

  it("should return true when deadline equals now", () => {
    const now = new Date();
    expect(isDeadlinePassed(now, now)).toBe(true);
  });

  it("should use provided 'now' instead of system time", () => {
    const deadline = new Date("2025-01-01T12:00:00Z");
    const before = new Date("2025-01-01T11:59:59Z");
    const after = new Date("2025-01-01T12:00:01Z");

    expect(isDeadlinePassed(deadline, before)).toBe(false);
    expect(isDeadlinePassed(deadline, after)).toBe(true);
  });
});

describe("getPendingReminders", () => {
  it("should return 1h reminder when 45 minutes remain", () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 45 * 60 * 1000);
    const pending = getPendingReminders(deadline, [], now);

    expect(pending.map((p) => p.label)).toContain("1h");
  });

  it("should return 30m reminder (not 10m) when exactly 20 minutes remain", () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 20 * 60 * 1000);
    const pending = getPendingReminders(deadline, [], now);

    const labels = pending.map((p) => p.label);
    expect(labels).toContain("1h");
    expect(labels).toContain("30m");
    expect(labels).not.toContain("10m"); // 20 min > 10 min drempel
  });

  it("should return all three reminders when 8 minutes remain", () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 8 * 60 * 1000);
    const pending = getPendingReminders(deadline, [], now);

    const labels = pending.map((p) => p.label);
    expect(labels).toContain("1h");
    expect(labels).toContain("30m");
    expect(labels).toContain("10m");
  });

  it("should return only 10m when 1h and 30m already sent with 8 minutes remaining", () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 8 * 60 * 1000);
    const pending = getPendingReminders(deadline, ["1h", "30m"], now);

    const labels = pending.map((p) => p.label);
    expect(labels).toEqual(["10m"]);
  });

  it("should not return already sent reminders", () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 45 * 60 * 1000);
    const pending = getPendingReminders(deadline, ["1h"], now);

    expect(pending.map((p) => p.label)).not.toContain("1h");
  });

  it("should return empty array when deadline has passed", () => {
    const past = new Date(Date.now() - 5000);
    const pending = getPendingReminders(past, []);
    expect(pending).toHaveLength(0);
  });

  it("should return empty array when no thresholds match", () => {
    const now = new Date();
    // 2 uur in de toekomst — geen enkele drempel wordt geraakt
    const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const pending = getPendingReminders(deadline, [], now);
    expect(pending).toHaveLength(0);
  });
});
