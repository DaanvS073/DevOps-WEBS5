const { consumeMessages } = require("./rabbitmq");
const { sendMail } = require("./mailer");

// Queue: user-registered → bevestigingsmail
async function handleUserRegistered(message) {
  const { email, role } = message;
  await sendMail(
    email,
    "Welkom bij Photo Prestiges!",
    `<h1>Welkom!</h1>
     <p>Je account is aangemaakt als <strong>${role}</strong>.</p>
     <p>Je kunt nu inloggen op Photo Prestiges.</p>`
  );
}

// Queue: deadline-reminder → herinnering aan deelnemers
async function handleDeadlineReminder(message) {
  const { targetId, label, participantEmails = [] } = message;
  for (const email of participantEmails) {
    await sendMail(
      email,
      `Herinnering: nog ${label} voor deadline`,
      `<h1>Deadline nadert!</h1>
       <p>Je hebt nog <strong>${label}</strong> om je foto in te dienen voor wedstrijd <strong>${targetId}</strong>.</p>`
    );
  }
}

// Queue: winner-determined → score-overzicht naar owner + individuele scores
async function handleWinnerDetermined(message) {
  const { targetId, winnerId, scores = [], ownerEmail, participantEmails = {} } = message;

  // Mail naar owner
  if (ownerEmail) {
    const scoreList = scores
      .map((s) => `<li>Gebruiker ${s.userId}: ${s.score.toFixed(2)} punten</li>`)
      .join("");
    await sendMail(
      ownerEmail,
      `Winnaar bepaald voor wedstrijd ${targetId}`,
      `<h1>Wedstrijd afgesloten</h1>
       <p>Winnaar: <strong>${winnerId}</strong></p>
       <ul>${scoreList}</ul>`
    );
  }

  // Individuele mail naar elke deelnemer
  for (const score of scores) {
    const email = participantEmails[score.userId];
    if (email) {
      const isWinner = score.userId === winnerId;
      await sendMail(
        email,
        `Jouw score voor wedstrijd ${targetId}`,
        `<h1>${isWinner ? "Gefeliciteerd, je hebt gewonnen!" : "Wedstrijd afgesloten"}</h1>
         <p>Jouw score: <strong>${score.score.toFixed(2)} punten</strong></p>`
      );
    }
  }
}

// Queue: score-calculated → score-notificatie naar deelnemer
async function handleScoreCalculated(message) {
  const { targetId, userId, score, userEmail } = message;
  if (!userEmail) return;

  await sendMail(
    userEmail,
    `Je score is berekend voor wedstrijd ${targetId}`,
    `<h1>Score ontvangen</h1>
     <p>Gebruiker <strong>${userId}</strong>, je score voor wedstrijd <strong>${targetId}</strong> is: <strong>${score.toFixed(2)} punten</strong>.</p>`
  );
}

async function startConsumers() {
  await consumeMessages("user-registered", handleUserRegistered);
  await consumeMessages("deadline-reminder", handleDeadlineReminder);
  await consumeMessages("winner-determined", handleWinnerDetermined);
  await consumeMessages("score-calculated", handleScoreCalculated);
  console.log("Mail Service consumers started.");
}

module.exports = {
  startConsumers,
  handleUserRegistered,
  handleDeadlineReminder,
  handleWinnerDetermined,
  handleScoreCalculated,
};
