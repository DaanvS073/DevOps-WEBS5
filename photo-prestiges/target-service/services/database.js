const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
const client = new MongoClient(uri);
const db = client.db(process.env.DB_NAME || "targets-db");

module.exports = { db, client };
