require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Joi = require("joi");
const axios = require("axios");
// const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 3001;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CREDENTIALS_PATH = path.join(__dirname, process.env.GOOGLE_CREDENTIALS_PATH);
// const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL;


app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// === MongoDB Schema ===
const userSchema = new mongoose.Schema({
  ism: String,
  telefon: String,
});
const User = mongoose.model("User", userSchema);

mongoose.connect(process.env.MONGO_URI);


function normalizePhone(phone) {
  phone = phone.replace(/\D/g, "");
  if (phone.startsWith("998") && phone.length === 12) return phone;
  if (phone.startsWith("9") && phone.length === 9) return "998" + phone;
  return null;
}

const schema = Joi.object({
  ism: Joi.string().min(2).max(100).required(),
  telefon: Joi.string().required().min(7).max(13),
});

async function appendToSheet(user) {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const values = [[user.ism, user.telefon, new Date().toISOString()]];

  sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Sheet1!A:D",
    valueInputOption: "RAW",
    resource: { values },
  });
}

// async function sendToBitrix(user) {
//   await axios.post(BITRIX_WEBHOOK_URL, {
//     fields: {
//       TITLE: `${user.ism} ${user.familiya}`,
//       NAME: user.ism,
//       PHONE: [{ VALUE: user.telefon, VALUE_TYPE: "WORK" }],
//     },
//   });
// }


app.post("/users", async (req, res) => {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { ism, telefon } = value;
    const normalizedPhone = normalizePhone(telefon);

    if (!normalizedPhone) {
      return res.status(400).json({ message: "Telefon raqami noto‘g‘ri formatda." });
    }

    const existingUser = await User.findOne({ telefon: normalizedPhone });
    if (existingUser) {
      return res.status(400).json({ message: "Bu telefon raqam allaqachon ro‘yxatdan o‘tgan." });
    }

    const user = new User({ ism, telefon: normalizedPhone });
    await user.save();

    // sendToBitrix(user).catch(console.error);
    appendToSheet(user).catch(console.error);

    res.status(200).json({ message: "Ariza muvaffaqiyatli yuborildi!" });
  } catch (err) {
    console.error("Xatolik:", err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi." });
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json({ users });
  } catch (err) {
    console.error("Xatolik:", err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi." });
  }
});

app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} da ishlayapti`);
});
