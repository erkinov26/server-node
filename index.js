const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const usersRouter = require("./routes/sample-users"); 
const registratedusersRouter = require('./routes/registrated-users')

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(bodyParser.json());

app.use("/sampleusers", usersRouter);
app.use("/registratedusers", registratedusersRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
});
