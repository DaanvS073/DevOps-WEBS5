const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Photo Prestiges API",
      version: "1.0.0",
      description:
        "Centrale API Gateway voor de Photo Prestiges fotospeurtocht-applicatie. " +
        "Alle requests lopen via deze gateway; interne microservices zijn niet direct bereikbaar.",
    },
    servers: [{ url: "/", description: "API Gateway" }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        Target: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            city: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            radius: { type: "number" },
            deadline: { type: "string", format: "date-time" },
            ownerId: { type: "string" },
            imageUrl: { type: "string" },
          },
        },
        Registration: {
          type: "object",
          properties: {
            _id: { type: "string" },
            targetId: { type: "string" },
            userId: { type: "string" },
            open: { type: "boolean" },
            registeredAt: { type: "string", format: "date-time" },
          },
        },
        Score: {
          type: "object",
          properties: {
            _id: { type: "string" },
            targetId: { type: "string" },
            userId: { type: "string" },
            score: { type: "number" },
          },
        },
        Competition: {
          type: "object",
          properties: {
            _id: { type: "string" },
            targetId: { type: "string" },
            title: { type: "string" },
            city: { type: "string" },
            status: { type: "string", enum: ["active", "finished"] },
            deadline: { type: "string", format: "date-time" },
          },
        },
        PaginatedTargets: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Target" } },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
            pages: { type: "integer" },
          },
        },
      },
    },
    tags: [
      { name: "Auth", description: "Registratie en login" },
      { name: "Targets", description: "Foto-targets beheren" },
      { name: "Submissions", description: "Foto-inzendingen" },
      { name: "Scores", description: "Score-resultaten" },
      { name: "Competitions", description: "Wedstrijdoverzicht" },
      { name: "Registrations", description: "Wedstrijd-inschrijvingen" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            200: { description: "Service is online", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" } } } } } },
          },
        },
      },
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Registreer een nieuwe gebruiker",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password", "role"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 6 },
                    role: { type: "string", enum: ["participant", "owner"] },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Gebruiker aangemaakt" },
            400: { description: "Ontbrekende of ongeldige velden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            409: { description: "E-mailadres al in gebruik" },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login en ontvang een JWT token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "JWT token", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } } },
            401: { description: "Ongeldige credentials" },
          },
        },
      },
      "/targets": {
        get: {
          tags: ["Targets"],
          summary: "Haal alle targets op (gefilterd en gepagineerd)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "city", in: "query", schema: { type: "string" }, description: "Filter op stad" },
            { name: "latitude", in: "query", schema: { type: "number" }, description: "Latitude voor radius-filter" },
            { name: "longitude", in: "query", schema: { type: "number" }, description: "Longitude voor radius-filter" },
            { name: "radius", in: "query", schema: { type: "number" }, description: "Zoekradius in graden" },
            { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Paginanummer" },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Resultaten per pagina" },
          ],
          responses: {
            200: { description: "Gepagineerde lijst van targets", content: { "application/json": { schema: { $ref: "#/components/schemas/PaginatedTargets" } } } },
            401: { description: "Niet geautoriseerd" },
          },
        },
        post: {
          tags: ["Targets"],
          summary: "Maak een nieuw target aan (alleen owners)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["title", "city", "deadline"],
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    city: { type: "string" },
                    latitude: { type: "number" },
                    longitude: { type: "number" },
                    radius: { type: "number" },
                    deadline: { type: "string", format: "date-time" },
                    image: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Target aangemaakt", content: { "application/json": { schema: { $ref: "#/components/schemas/Target" } } } },
            400: { description: "Ontbrekende velden" },
            401: { description: "Niet geautoriseerd" },
          },
        },
      },
      "/targets/{id}": {
        delete: {
          tags: ["Targets"],
          summary: "Verwijder een target (alleen de owner)",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Target verwijderd" },
            403: { description: "Alleen de owner mag verwijderen" },
            404: { description: "Target niet gevonden" },
          },
        },
      },
      "/targets/{id}/submit": {
        post: {
          tags: ["Submissions"],
          summary: "Dien een foto in voor een target",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Target ID" }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["image"],
                  properties: { image: { type: "string", format: "binary" } },
                },
              },
            },
          },
          responses: {
            201: { description: "Inzending opgeslagen" },
            400: { description: "Deadline verstreken of geen afbeelding" },
            404: { description: "Target niet gevonden" },
          },
        },
      },
      "/scores/{targetId}": {
        get: {
          tags: ["Scores"],
          summary: "Haal alle scores op voor een target",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "targetId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Lijst van scores", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Score" } } } } },
          },
        },
      },
      "/scores/{targetId}/my": {
        get: {
          tags: ["Scores"],
          summary: "Haal eigen score op voor een target",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "targetId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Score van ingelogde gebruiker", content: { "application/json": { schema: { $ref: "#/components/schemas/Score" } } } },
            404: { description: "Geen score gevonden" },
          },
        },
      },
      "/competitions": {
        get: {
          tags: ["Competitions"],
          summary: "Haal alle actieve wedstrijden op (gefilterd en gepagineerd)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "city", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["active", "finished"] } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            200: { description: "Lijst van wedstrijden", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Competition" } } } } },
          },
        },
      },
      "/register/{targetId}": {
        post: {
          tags: ["Registrations"],
          summary: "Schrijf je in voor een wedstrijd",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "targetId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            201: { description: "Inschrijving geslaagd", content: { "application/json": { schema: { $ref: "#/components/schemas/Registration" } } } },
            400: { description: "Inschrijving gesloten" },
            409: { description: "Al ingeschreven" },
          },
        },
        get: {
          tags: ["Registrations"],
          summary: "Haal alle inschrijvingen op voor een wedstrijd",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "targetId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Lijst van inschrijvingen", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Registration" } } } } },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
