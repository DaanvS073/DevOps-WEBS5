# Photo Prestiges

Een microservices-applicatie voor foto-speurtochten. Deelnemers fotograferen locaties, eigenaars beoordelen inzendingen via AI-analyse.

## Service Status

| Service | CI |
|---|---|
| API Gateway | ![CI](https://github.com/DaanvS073/DevOps-WEBS5/actions/workflows/CI-api-gateway.yml/badge.svg) |
| Auth Service | ![CI](https://github.com/DaanvS073/DevOps-WEBS5/actions/workflows/CI-auth-service.yml/badge.svg) |
| Target Service | ![CI](https://github.com/DaanvS073/DevOps-WEBS5/actions/workflows/CI-target-service.yml/badge.svg) |
| Score Service | ![CI](https://github.com/DaanvS073/DevOps-WEBS5/actions/workflows/CI-score-service.yml/badge.svg) |
| Mail Service | ![CI](https://github.com/DaanvS073/DevOps-WEBS5/actions/workflows/CI-mail-service.yml/badge.svg) |
| Register Service | ![CI](https://github.com/DaanvS073/DevOps-WEBS5/actions/workflows/CI-register-service.yml/badge.svg) |
| Read Service | ![CI](https://github.com/DaanvS073/DevOps-WEBS5/actions/workflows/CI-read-service.yml/badge.svg) |
| Clock Service | ![CI](https://github.com/DaanvS073/DevOps-WEBS5/actions/workflows/CI-clock-service.yml/badge.svg) |

## Architectuur

```
                        ┌─────────────┐
           Buitenwereld │ api-gateway │ :3000
                        └──────┬──────┘
                               │ JWT-check op alle routes behalve /auth & /health
           ┌───────────────────┼───────────────────────┐
           │                   │                       │
    ┌──────▼──────┐   ┌────────▼───────┐   ┌──────────▼──────┐
    │ auth-service│   │ target-service │   │  score-service  │
    │    :3001    │   │    :3002       │   │    :3003        │
    └──────┬──────┘   └────────┬───────┘   └──────────┬──────┘
           │                   │                       │
    ┌──────▼───────────────────▼───────────────────────▼──────┐
    │                       RabbitMQ                          │
    └──────┬───────────────────┬───────────────────────┬──────┘
           │                   │                       │
    ┌──────▼──────┐   ┌────────▼───────┐   ┌──────────▼──────┐
    │ mail-service│   │register-service│   │  clock-service  │
    │    :3004    │   │    :3005       │   │    :3007        │
    └─────────────┘   └────────────────┘   └─────────────────┘
                               │
                      ┌────────▼───────┐
                      │  read-service  │
                      │    :3006       │
                      └────────────────┘
```

## RabbitMQ Queues

| Queue | Publisher | Consumer(s) |
|---|---|---|
| `target-created` | target-service | clock-service, read-service |
| `target-deleted` | target-service | read-service |
| `submission-received` | target-service | score-service |
| `score-calculated` | score-service | mail-service |
| `deadline-reminder` | clock-service | mail-service |
| `deadline-reached` | clock-service | score-service, read-service |
| `close-registration` | clock-service | register-service |
| `winner-determined` | score-service | mail-service |
| `user-registered` | auth-service | mail-service |

## Opstarten

```bash
# Development (live reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production
docker-compose up --build
```

Maak een `.env` bestand in deze map met:

```
JWT_SECRET=jouw-geheime-sleutel
IMAGGA_API_KEY=jouw-imagga-key
IMAGGA_API_SECRET=jouw-imagga-secret
SENDGRID_API_KEY=jouw-sendgrid-key
```

## Services

| Service | Poort | Database | Beschrijving |
|---|---|---|---|
| api-gateway | 3000 | — | Reverse proxy, JWT-authenticatie |
| auth-service | 3001 | mongo-auth | Registratie & login |
| target-service | 3002 | mongo-targets | Beheer van foto-targets & inzendingen |
| score-service | 3003 | mongo-scores | Scorebrekening via Imagga AI |
| mail-service | 3004 | — | E-mailnotificaties via SendGrid |
| register-service | 3005 | mongo-register | Inschrijvingen voor wedstrijden |
| read-service | 3006 | mongo-read | Overzicht actieve wedstrijden |
| clock-service | 3007 | mongo-clock | Deadline-timers & herinneringen |
