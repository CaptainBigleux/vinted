require("dotenv").config();
const express = require("express");
const formidableMiddleware = require("express-formidable");
const mongoose = require("mongoose");
const cors = require("cors");
const isAuthenticated = require("./middlewares/isAuthenticated");
const Offer = require("./models/Offer");

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

app.post("/payment", isAuthenticated, async (req, res) => {
  try {
    const { stripeToken, productID } = req.fields; // will use id to use actual back price parameters

    const offer = await Offer.findById(productID);
    console.log(offer);
    const priceInCents = Number(offer.product_price * 100);
    console.log("prix centimes", priceInCents);
    console.log("pp initial", offer.product_price);

    const response = await stripe.charges.create({
      amount: priceInCents, // will change with findid
      currency: "eur",
      description: offer.product_name,
      // On envoie ici le token
      source: stripeToken,
    });

    return res.json(response);
  } catch (error) {
    console.log(error.message);
    return res.status(400).json(error);
  }
});

app.all("*", (req, res) => {
  res.status(404).json("Page indisponible.");
});

app.listen(process.env.PORT, () => {
  console.log("Server start");
});
