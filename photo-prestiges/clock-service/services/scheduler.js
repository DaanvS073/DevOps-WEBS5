const cron = require("node-cron");
const { db } = require("./database");
const { publishMessage } = require("./rabbitmq");

// Drempelwaarden voor herinneringen (in ms)
const REMINDER_THRESHOLDS = [
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "30m", ms: 30 * 60 * 1000 },
  { label: "10m", ms: 10 * 60 * 1000 },
];

/**
 * Controleer of een deadline verlopen is.
 * @param {Date} deadline
 * @param {Date} now
 * @returns {boolean}
 */
function isDeadlinePassed(deadline, now = new Date()) {
  return new Date(deadline) <= now;
}

/**
 * Bepaal welke herinneringen nog verstuurd moeten worden.
 * @param {Date} deadline
 * @param {string[]} sentReminders - Labels van al verstuurde herinneringen
 * @param {Date} now
 * @returns {Array<{label: string, ms: number}>}
 */
function getPendingReminders(deadline, sentReminders = [], now = new Date()) {
  const timeRemaining = new Date(deadline) - now;
  return REMINDER_THRESHOLDS.filter(
    (t) => timeRemaining > 0 && timeRemaining <= t.ms && !sentReminders.includes(t.label)
  );
}

/**
 * Start de cron scheduler — checkt elke minuut alle actieve timers.
 */
function startScheduler() {
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    try {
      const timers = await db.collection("timers").find({ fired: false }).toArray();

      for (const timer of timers) {
        const { targetId, deadline, reminders = [] } = timer;

        // Herinneringen versturen
        const pending = getPendingReminders(deadline, reminders, now);
        for (const reminder of pending) {
          await publishMessage("deadline-reminder", {
            targetId,
            timeRemaining: reminder.ms,
            label: reminder.label,
          });
          await db.collection("timers").updateOne(
            { targetId },
            { $push: { reminders: reminder.label } }
          );
          console.log(`Reminder sent for target ${targetId}: ${reminder.label} remaining`);
        }

        // Deadline verlopen
        if (isDeadlinePassed(deadline, now)) {
          await publishMessage("deadline-reached", { targetId });
          await publishMessage("close-registration", { targetId });
          await db.collection("timers").updateOne({ targetId }, { $set: { fired: true } });
          console.log(`Deadline reached for target ${targetId}`);
        }
      }
    } catch (err) {
      console.error("Scheduler error:", err.message);
    }
  });

  console.log("Clock Service scheduler started (runs every minute).");
}

module.exports = { startScheduler, isDeadlinePassed, getPendingReminders };
