const axios = require("axios");

// Mock axios voor Imagga API calls
jest.mock("axios");

const { analyzeImage, calculateScore } = require("../../services/imagga");

describe("analyzeImage", () => {
  it("should return an array of tag/confidence objects", async () => {
    axios.get.mockResolvedValue({
      data: {
        result: {
          tags: [
            { tag: { en: "cat" }, confidence: 85.5 },
            { tag: { en: "animal" }, confidence: 72.3 },
            { tag: { en: "pet" }, confidence: 60.1 },
          ],
        },
      },
    });

    const result = await analyzeImage("http://example.com/image.jpg");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ tag: "cat", confidence: 85.5 });
    expect(result[1]).toEqual({ tag: "animal", confidence: 72.3 });
    expect(result[2]).toEqual({ tag: "pet", confidence: 60.1 });
  });

  it("should call the Imagga API with correct params", async () => {
    axios.get.mockResolvedValue({
      data: { result: { tags: [] } },
    });

    await analyzeImage("http://example.com/test.jpg");

    expect(axios.get).toHaveBeenCalledWith(
      "https://api.imagga.com/v2/tags",
      expect.objectContaining({
        params: { image_url: "http://example.com/test.jpg" },
      })
    );
  });

  it("should return empty array when no tags", async () => {
    axios.get.mockResolvedValue({
      data: { result: { tags: [] } },
    });

    const result = await analyzeImage("http://example.com/empty.jpg");
    expect(result).toEqual([]);
  });
});

describe("calculateScore", () => {
  const targetLabels = [
    { tag: "cat", confidence: 90 },
    { tag: "animal", confidence: 80 },
    { tag: "pet", confidence: 70 },
  ];

  it("should return 0 when there are no matching labels", () => {
    const submissionLabels = [
      { tag: "car", confidence: 95 },
      { tag: "vehicle", confidence: 85 },
    ];

    const score = calculateScore(targetLabels, submissionLabels, 1000, 10000);
    // overeenkomst = 0, snelheidsBonus = 100 - (1000/10000)*100 = 90
    // score = 0 * 0.7 + 90 * 0.3 = 27
    expect(score).toBeCloseTo(27, 1);
  });

  it("should return higher score when all labels match", () => {
    const submissionLabels = [
      { tag: "cat", confidence: 90 },
      { tag: "animal", confidence: 80 },
      { tag: "pet", confidence: 70 },
    ];

    const score = calculateScore(targetLabels, submissionLabels, 1000, 10000);
    // overeenkomst = gemiddelde van ((90+90)/2, (80+80)/2, (70+70)/2) = (90+80+70)/3 = 80
    // snelheidsBonus = 90
    // score = 80*0.7 + 90*0.3 = 56 + 27 = 83
    expect(score).toBeCloseTo(83, 1);
  });

  it("should give higher score for faster submissions", () => {
    const submissionLabels = [{ tag: "cat", confidence: 90 }];

    const scoreFast = calculateScore(targetLabels, submissionLabels, 1000, 10000);
    const scoreSlow = calculateScore(targetLabels, submissionLabels, 9000, 10000);

    expect(scoreFast).toBeGreaterThan(scoreSlow);
  });

  it("should be case-insensitive when matching labels", () => {
    const submissionLabels = [{ tag: "CAT", confidence: 90 }];

    const score = calculateScore(targetLabels, submissionLabels, 5000, 10000);
    // snelheidsBonus = 100 - 50 = 50
    // overeenkomst = (90+90)/2 = 90
    // score = 90*0.7 + 50*0.3 = 63 + 15 = 78
    expect(score).toBeCloseTo(78, 1);
  });

  it("should clamp score between 0 and 100", () => {
    const score = calculateScore([], [], 0, 0);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should use correct formula: 70% match + 30% speed", () => {
    const submissionLabels = [{ tag: "cat", confidence: 90 }];
    // Matching: alleen "cat" => confidence gemiddeld (90+90)/2 = 90
    // Indiening na 50% van de totale tijd => snelheidsBonus = 50
    // Verwachte score = 90 * 0.7 + 50 * 0.3 = 63 + 15 = 78
    const score = calculateScore(targetLabels, submissionLabels, 5000, 10000);
    expect(score).toBeCloseTo(78, 1);
  });
});
