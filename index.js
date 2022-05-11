require("dotenv").config();
const express = require("express");
const formidableMiddleware = require("express-formidable");
const mongoose = require("mongoose");
const cors = require("cors");

const stripe = require("stripe")(process.env.STRIPE_API_SECRET);

const app = express();
app.use(formidableMiddleware());
app.use(cors());

// mongoose.connect("mongodb://localhost/Vinted"); local
mongoose.connect(process.env.MONGODB_URI);

const UserRoutes = require("./routes/users");
app.use(UserRoutes);

const OfferRoutes = require("./routes/offers");
app.use(OfferRoutes);

app.post("/payment", async (req, res) => {
  //need to export isauthenticated to use it here
  try {
    const { token, _id } = req.fields; // will use id to use actual back price parameters

    const response = await stripe.charges.create({
      amount: 2000, // will change with findid
      currency: "eur",
      description: "La description de l'objet acheté", // will change with findid
      // On envoie ici le token
      source: token,
    });

    return res.json(response);
  } catch (error) {
    return res.json(error);
  }
});

app.all("*", (req, res) => {
  res.status(404).json("Page indisponible.");
});

app.listen(process.env.PORT, () => {
  console.log("Server start");
});
