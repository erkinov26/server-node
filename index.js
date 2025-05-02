const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const Joi = require("joi");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = "Sheet1";
const CREDENTIALS_PATH = path.join(__dirname, process.env.GOOGLE_CREDENTIALS_PATH);

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(bodyParser.json());

// JOI validatsiyasi
const schema = Joi.object({
  ism: Joi.string().min(2).max(100).required(),
  telefon: Joi.string().pattern(/^998\d{9}$/).required(),
});

function validateRequest(body) {
  const { error, value } = schema.validate(body);
  if (!error) return { value };

  const detail = error.details[0];
  const field = detail.path[0];
  const type = detail.type;
  let errorMessage = "Nomaʼlum xatolik";

  if (field === "telefon") {
    if (type === "string.pattern.base") {
      errorMessage = "Telefon raqam formati noto‘g‘ri. Masalan: 998901234567";
    } else if (type === "string.base") {
      errorMessage = "Telefon raqam matn (text) bo‘lishi kerak.";
    } else {
      errorMessage = "Telefon raqam noto‘g‘ri kiritilgan.";
    }
  } else if (field === "ism") {
    if (type === "string.min") {
      errorMessage = "Ism juda qisqa.";
    } else if (type === "string.max") {
      errorMessage = "Ism juda uzun.";
    } else if (type === "string.base") {
      errorMessage = "Ism matn (text) bo‘lishi kerak.";
    } else {
      errorMessage = "Ism noto‘g‘ri kiritilgan.";
    }
  }

  return { error: errorMessage };
}
const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Telefon raqami mavjudligini tekshiruvchi funksiya
async function checkPhoneInSheet(telefon) {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!B:B`,
    });

    const values = response.data.values || [];
    const phoneExists = values.some(row => row[0] === telefon);
    return phoneExists;
  } catch (err) {
    return false;
  }
}

async function appendToSheet(user) {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [[user.ism, user.telefon, user.createdAt.toISOString()]],
      },
    });

    if (response.status === 200) {
      return { success: true };
    } else {
      return { success: false, reason: `Kutilmagan status: ${response.status}` };
    }
  } catch (err) {
    let reason = "Noma'lum xatolik yuz berdi";
    if (err.code === 403) {
      reason = "Ruxsat yo‘q. JSON fayldagi 'client_email' ni Sheets faylga 'Editor' sifatida qo‘shing.";
    } else if (err.code === 404) {
      reason = "Sheets ID yoki varaq nomi noto‘g‘ri.";
    } else if (err.response?.data?.error?.message) {
      reason = `${err.response.data.error.message}`;
    } else if (err.message) {
      reason = err.message;
    }

    console.error("❌ Sheets xatosi:", reason);
    return { success: false, reason };
  }
}

async function getDataFromSheet() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:C`,
    });

    const rows = response.data.values || [];
    const users = rows.map(row => ({
      ism: row[0] || "",
      telefon: row[1] || "",
      createdAt: row[2] || "",
    }));

    return users;
  } catch (err) {
    console.error("❌ Sheets'dan ma'lumot olishda xatolik:", err.message);
    return [];
  }
}

app.post("/users", async (req, res) => {
  const { error, value } = validateRequest(req.body);
  if (error) return res.status(400).json({ error });

  const { ism, telefon } = value;

  try {
    const phoneExistsInSheet = await checkPhoneInSheet(telefon);
    if (phoneExistsInSheet) {
      return res.status(400).json({ error: "Ushbu telefon raqami allaqachon ro'yxatdan o'tgan." });
    }

    const result = await appendToSheet({ ism, telefon, createdAt: new Date() });
    if (!result.success) {
      return res.status(500).json({ error: "Malumot saqlanmadi yozilmadi.", reason: result.reason });
    }

    res.status(200).json({ message: "✅ Ma'lumot saqlandi)" });
  } catch (err) {
    res.status(500).json({ error: "Serverda ichki xatolik", reason: err.message });
  }
});

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

app.listen(PORT, () => {
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
});
