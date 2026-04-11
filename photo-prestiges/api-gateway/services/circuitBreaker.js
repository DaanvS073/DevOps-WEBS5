const CircuitBreaker = require("opossum");

const DEFAULT_OPTIONS = {
  timeout: 5000,          // Fail als service niet binnen 5s antwoordt
  errorThresholdPercentage: 50, // Open circuit bij >50% fouten
  resetTimeout: 10000,    // Na 10s opnieuw proberen (half-open)
  volumeThreshold: 3,     // Minimaal 3 requests vóór circuit opent
};

const breakers = {};

/**
 * Geeft een CircuitBreaker terug voor de gegeven servicenaam.
 * Elke service krijgt zijn eigen breaker (gefaseerd falen).
 */
function getBreaker(serviceName, fn, options = {}) {
  if (!breakers[serviceName]) {
    const breaker = new CircuitBreaker(fn, { ...DEFAULT_OPTIONS, ...options });

    breaker.on("open", () =>
      console.warn(`[CircuitBreaker] OPEN  — ${serviceName} niet bereikbaar`)
    );
    breaker.on("halfOpen", () =>
      console.info(`[CircuitBreaker] HALF-OPEN — ${serviceName} opnieuw proberen`)
    );
    breaker.on("close", () =>
      console.info(`[CircuitBreaker] CLOSED — ${serviceName} weer bereikbaar`)
    );
    breaker.on("fallback", () =>
      console.warn(`[CircuitBreaker] FALLBACK — ${serviceName}`)
    );

    breakers[serviceName] = breaker;
  }
  return breakers[serviceName];
}

/**
 * Express error-handler voor proxy fouten.
 * Retourneert 503 met Retry-After header wanneer service onbereikbaar is.
 */
function proxyErrorHandler(serviceName) {
  return (err, req, res) => {
    const isCircuitOpen =
      err.message === "Circuit breaker is open" ||
      err.code === "ECONNREFUSED" ||
      err.code === "ECONNRESET" ||
      err.code === "ETIMEDOUT";

    if (isCircuitOpen) {
      console.error(`[Proxy] ${serviceName} onbereikbaar: ${err.message}`);
      return res.status(503).json({
        error: "Service tijdelijk niet beschikbaar",
        service: serviceName,
        retryAfter: 10,
      });
    }

    res.status(502).json({ error: "Bad Gateway", details: err.message });
  };
}

module.exports = { getBreaker, proxyErrorHandler };
