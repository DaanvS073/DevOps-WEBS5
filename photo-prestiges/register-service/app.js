const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const registrationsRouter = require("./routes/registrations");
const healthRouter = require("./routes/health");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/registrations", registrationsRouter);
app.use("/health", healthRouter);

module.exports = app;
