const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const usersRouter = require("./routes/sample-users"); // Users routelarini import qilish
const registratedusersRouter = require('./routes/registrated-users')

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(bodyParser.json());

// Routes
app.use("/sampleusers", usersRouter); // "/users" uchun routes
app.use("/registratedusers", registratedusersRouter); // "/users" uchun routes

app.listen(PORT, () => {
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
});
