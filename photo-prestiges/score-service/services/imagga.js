const axios = require("axios");

/**
 * Analyseer een afbeelding via de Imagga Tagging API.
 * @param {string} imageUrl - Publiek bereikbare URL van de afbeelding
 * @returns {Promise<Array<{tag: string, confidence: number}>>}
 */
async function analyzeImage(imageUrl) {
  const apiKey = process.env.IMAGGA_API_KEY;
  const apiSecret = process.env.IMAGGA_API_SECRET;

  const response = await axios.get("https://api.imagga.com/v2/tags", {
    params: { image_url: imageUrl },
    auth: { username: apiKey, password: apiSecret },
  });

  const tags = response.data.result.tags;
  return tags.map((t) => ({
    tag: t.tag.en,
    confidence: t.confidence,
  }));
}

/**
 * Bereken een score op basis van label-overeenkomst en indientijd.
 *
 * @param {Array<{tag: string, confidence: number}>} targetLabels
 * @param {Array<{tag: string, confidence: number}>} submissionLabels
 * @param {number} submissionTime - Tijd in ms na start van de wedstrijd
 * @param {number} totalTime     - Totale wedstrijdduur in ms
 * @returns {number} Score tussen 0 en 100
 */
function calculateScore(targetLabels, submissionLabels, submissionTime, totalTime) {
  const targetTagMap = new Map(targetLabels.map((l) => [l.tag.toLowerCase(), l.confidence]));

  const matchingConfidences = submissionLabels
    .filter((l) => targetTagMap.has(l.tag.toLowerCase()))
    .map((l) => (l.confidence + targetTagMap.get(l.tag.toLowerCase())) / 2);

  const overeenkomstPercentage =
    matchingConfidences.length > 0
      ? matchingConfidences.reduce((sum, c) => sum + c, 0) / matchingConfidences.length
      : 0;

  const snelheidsBonus = totalTime > 0
    ? 100 - (submissionTime / totalTime) * 100
    : 0;

  const score = overeenkomstPercentage * 0.7 + snelheidsBonus * 0.3;
  return Math.max(0, Math.min(100, score));
}

module.exports = { analyzeImage, calculateScore };
