const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const targetsRouter = require("./routes/targets");
const submissionsRouter = require("./routes/submissions");
const healthRouter = require("./routes/health");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serveer geüploade foto's statisch
app.use("/images", express.static(path.join(__dirname, "uploads")));

app.use("/targets", targetsRouter);
app.use("/submissions", submissionsRouter);
app.use("/health", healthRouter);

module.exports = app;
