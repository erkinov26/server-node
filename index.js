const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const Joi = require("joi");
const path = require("path");
const cors = require("cors");
const https = require("https"); // HTTPS modulini import qilish
const fs = require("fs"); // Fayllar bilan ishlash uchun
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = "Sheet1";
const CREDENTIALS_PATH = path.join(__dirname, process.env.GOOGLE_CREDENTIALS_PATH);

// Sertifikat va xususiy kalit fayllarini o'qish
const privateKey = fs.readFileSync(path.join(__dirname, "privkey.pem"), "utf8");
const certificate = fs.readFileSync(path.join(__dirname, "fullchain.pem"), "utf8");

const credentials = { key: privateKey, cert: certificate };

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(bodyParser.json());

// Google Sheets API va boshqa kodlar (o'zgarmagan)

app.get("/users", async (req, res) => {
  try {
    const users = await getDataFromSheet();

    if (users.length === 0) {
      return res.status(404).json({ message: "Ma'lumot topilmadi" });
    }

    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ error: "Serverda ichki xatolik", reason: err.message });
  }
});

// HTTPS serverni ishga tushurish
https.createServer(credentials, app).listen(PORT, () => {
  console.log(`🚀 HTTPS server ishga tushdi: https://localhost:${PORT}`);
});
