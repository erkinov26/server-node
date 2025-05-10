const express = require("express");
const Joi = require("joi");
const { google } = require("googleapis");
const path = require("path");

const router = express.Router();
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = "Registration users";
const CREDENTIALS_PATH = path.join(__dirname, "../", process.env.GOOGLE_CREDENTIALS_PATH);
const schema = Joi.object({
  ism: Joi.string().min(2).max(100).required(),
  telefon: Joi.string().pattern(/^\+998\d{9}$/).required(),
  viloyat: Joi.string().min(3).max(100).required(),
  talim_shakli: Joi.string().valid("Bakalavr kunduzgi", "Magistratura").required(),
  talim_yonalishi: Joi.string().min(3).max(100).required(),
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
      errorMessage = "Telefon raqam formati noto‘g‘ri. Masalan: +998901234567";
    } else {
      errorMessage = "Telefon raqam noto‘g‘ri kiritilgan.";
    }
  } else if (field === "ism") {
    if (type === "string.min") {
      errorMessage = "Ism juda qisqa.";
    } else if (type === "string.max") {
      errorMessage = "Ism juda uzun.";
    } else {
      errorMessage = "Ism noto‘g‘ri kiritilgan.";
    }
  } else if (field === "viloyat") {
    errorMessage = "Viloyat nomi noto‘g‘ri yoki juda qisqa.";
  } else if (field === "talim_shakli") {
    errorMessage = "Ta'lim shakli noto‘g‘ri. Faqat: kunduzgi, sirtqi, masofaviy bo'lishi mumkin.";
  } else if (field === "talim_yonalishi") {
    errorMessage = "Ta'lim yo‘nalishi noto‘g‘ri yoki juda qisqa.";
  }

  return { error: errorMessage };
}

const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

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
        values: [
          [
            user.ism,
            user.telefon,
            user.viloyat,
            user.talim_shakli,
            user.talim_yonalishi,
            user.createdAt.toISOString()
          ],
        ],
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

    return { success: false, reason };
  }
}

async function getDataFromSheet() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
    });

    const rows = response.data.values || [];
    const users = rows.map(row => ({
      ism: row[0] || "",
      telefon: row[1] || "",
      viloyat: row[2] || "",
      talim_shakli: row[3] || "",
      talim_yonalishi: row[4] || "",
      createdAt: row[5] || "",
    }));

    return users;
  } catch (err) {
    return [];
  }
}

router.post("/", async (req, res) => {
  const { error, value } = validateRequest(req.body);
  if (error) return res.status(400).json({ error });

  const { ism, telefon, viloyat, talim_shakli, talim_yonalishi } = value;

  try {
    const phoneExistsInSheet = await checkPhoneInSheet(telefon);
    if (phoneExistsInSheet) {
      return res.status(400).json({ error: "Ushbu telefon raqami allaqachon ro'yxatdan o'tgan." });
    }

    const result = await appendToSheet({
      ism,
      telefon,
      viloyat,
      talim_shakli,
      talim_yonalishi,
      createdAt: new Date()
    });

    if (!result.success) {
      return res.status(500).json({ error: "Ma'lumot saqlanmadi", reason: result.reason });
    }

    res.status(200).json({ message: "✅ Ma'lumot saqlandi" });
  } catch (err) {
    res.status(500).json({ error: "Serverda ichki xatolik", reason: err.message });
  }
});

router.get("/", async (req, res) => {
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

module.exports = router;
