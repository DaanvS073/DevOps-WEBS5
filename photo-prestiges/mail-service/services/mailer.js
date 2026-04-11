const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

/**
 * Verstuur een e-mail via SendGrid, of log naar console in development.
 * @param {string} to
 * @param {string} subject
 * @param {string} htmlContent
 */
async function sendMail(to, subject, htmlContent) {
  const msg = {
    to,
    from: process.env.FROM_EMAIL || "noreply@photo-prestiges.com",
    subject,
    html: htmlContent,
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("=== [MAIL - development mode] ===");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:    ${htmlContent}`);
    console.log("=================================");
    return;
  }

  await sgMail.send(msg);
}

module.exports = { sendMail };
