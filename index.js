require("dotenv").config;
const express = require("express");
const formidableMiddleware = require("express-formidable");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(formidableMiddleware());
app.use(cors());

// mongoose.connect("mongodb://localhost/Vinted"); local
mongoose.connect(process.env.MONGODB_URI);

const UserRoutes = require("./routes/users");
app.use(UserRoutes);

const OfferRoutes = require("./routes/offers");
app.use(OfferRoutes);

app.all("*", (req, res) => {
  res.status(404).json("Page indisponible.");
});

app.listen(process.env.PORT, () => {
  console.log("Server start");
});
