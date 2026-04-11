const axios = require("axios");
const { consumeMessages, publishMessage } = require("./rabbitmq");
const { analyzeImage, calculateScore } = require("./imagga");
const { db } = require("./database");

const TARGET_SERVICE_URL = process.env.TARGET_SERVICE_URL || "http://localhost:3002";

/**
 * Consumer voor queue 'submission-received'.
 * Analyseert beide afbeeldingen via Imagga, berekent een score en slaat op.
 */
async function handleSubmissionReceived(message) {
  const { targetId, submissionId, userId, imageUrl } = message;

  try {
    // Haal target op via target-service
    const targetRes = await axios.get(`${TARGET_SERVICE_URL}/targets/${targetId}`);
    const target = targetRes.data;

    if (!target.imageUrl) {
      console.warn(`Target ${targetId} has no reference image, skipping scoring.`);
      return;
    }

    const baseUrl = TARGET_SERVICE_URL;
    const targetImageUrl = `${baseUrl}${target.imageUrl}`;
    const submissionImageUrl = `${baseUrl}${imageUrl}`;

    const [targetLabels, submissionLabels] = await Promise.all([
      analyzeImage(targetImageUrl),
      analyzeImage(submissionImageUrl),
    ]);

    const deadline = new Date(target.deadline);
    const createdAt = new Date(target.createdAt);
    const now = new Date();

    const totalTime = deadline - createdAt;
    const submissionTime = now - createdAt;

    const score = calculateScore(targetLabels, submissionLabels, submissionTime, totalTime);

    await db.collection("scores").insertOne({
      targetId,
      submissionId,
      userId,
      score,
      targetLabels,
      submissionLabels,
      calculatedAt: now,
    });

    await publishMessage("score-calculated", { targetId, userId, score });

    console.log(`Score calculated for submission ${submissionId}: ${score.toFixed(2)}`);
  } catch (err) {
    console.error(`Error processing submission ${submissionId}:`, err.message);
  }
}

/**
 * Consumer voor queue 'deadline-reached'.
 * Bepaalt de winnaar op basis van de hoogste score.
 */
async function handleDeadlineReached(message) {
  const { targetId } = message;

  try {
    const scores = await db.collection("scores").find({ targetId }).toArray();

    if (scores.length === 0) {
      console.warn(`No scores found for target ${targetId}`);
      return;
    }

    const winner = scores.reduce((best, s) => (s.score > best.score ? s : best), scores[0]);

    await publishMessage("winner-determined", {
      targetId,
      winnerId: winner.userId,
      scores: scores.map((s) => ({ userId: s.userId, score: s.score })),
    });

    console.log(`Winner for target ${targetId}: user ${winner.userId} with score ${winner.score.toFixed(2)}`);
  } catch (err) {
    console.error(`Error determining winner for target ${targetId}:`, err.message);
  }
}

async function startConsumers() {
  await consumeMessages("submission-received", handleSubmissionReceived);
  await consumeMessages("deadline-reached", handleDeadlineReached);
  console.log("Score Service consumers started.");
}

module.exports = { startConsumers, handleSubmissionReceived, handleDeadlineReached };
