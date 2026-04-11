const { consumeMessages } = require("./rabbitmq");
const { db } = require("./database");

// target-created → sla target info lokaal op als wedstrijd
async function handleTargetCreated(message) {
  const { targetId, title, city, deadline, ownerId } = message;
  await db.collection("competitions").updateOne(
    { targetId: String(targetId) },
    {
      $set: {
        targetId: String(targetId),
        title,
        city,
        deadline: new Date(deadline),
        ownerId: String(ownerId),
        status: "active",
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  console.log(`Competition registered: ${targetId}`);
}

// deadline-reached → update status naar finished
async function handleDeadlineReached(message) {
  const { targetId } = message;
  await db.collection("competitions").updateOne(
    { targetId: String(targetId) },
    { $set: { status: "finished", updatedAt: new Date() } }
  );
  console.log(`Competition finished: ${targetId}`);
}

// target-deleted → verwijder lokale kopie
async function handleTargetDeleted(message) {
  const { targetId } = message;
  await db.collection("competitions").deleteOne({ targetId: String(targetId) });
  console.log(`Competition removed: ${targetId}`);
}

async function startConsumers() {
  await consumeMessages("target-created", handleTargetCreated);
  await consumeMessages("deadline-reached", handleDeadlineReached);
  await consumeMessages("target-deleted", handleTargetDeleted);
  console.log("Read Service consumers started.");
}

module.exports = {
  startConsumers,
  handleTargetCreated,
  handleDeadlineReached,
  handleTargetDeleted,
};
