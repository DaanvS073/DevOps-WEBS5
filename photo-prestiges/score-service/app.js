const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const scoresRouter = require("./routes/scores");
const healthRouter = require("./routes/health");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/scores", scoresRouter);
app.use("/health", healthRouter);

module.exports = app;
