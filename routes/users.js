const express = require("express");
const router = express.Router();
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");
const cloudinary = require("cloudinary").v2;

const User = require("../models/User");

//#region validate email and password
const validateEmail = (email) => {
  const emailBits = email.toLowerCase().split("@"); // will return original string if no @ is found, else an array of strings
  if (email.split(" ").length > 1) return false;
  if (emailBits.length !== 2) return false; // only 1 at
  if (emailBits[1].split(".").length > 2) return false; // only 1 dot after at

  return true;
};

const validatePassword = (password) => {
  const arrPass = password.split("");
  const isLongEnough = arrPass.length >= 8 ? true : false;
  const specialCharacters = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/; // regex
  let isOneMaj = false;
  let isOneMin = false;
  let isOneNumber = false;
  let isOneSpecial = false;

  for (let i = 0; i < arrPass.length; i++) {
    if (!isOneMaj)
      isOneMaj = arrPass[i] === arrPass[i].toUpperCase() ? true : false;
    if (!isOneMin)
      isOneMin = arrPass[i] === arrPass[i].toLowerCase() ? true : false;
    if (!isOneNumber) isOneNumber = parseInt(arrPass[i]) === NaN ? false : true;
    if (!isOneSpecial) {
      if (specialCharacters.test(arrPass[i])) isOneSpecial = true; //test() to test regex
    }
  }

  if (isLongEnough && isOneMaj && isOneMin && isOneNumber && isOneSpecial) {
    return true;
  } else return false;
};
//#endregion

//#region SIGNUP
router.post("/user/signup", async (req, res) => {
  try {
    const query = req.fields;

    //#region tests de validité d'inputs

    //if username is falsy
    if (!query.username) {
      res.status(400).json("Nom d'utilisateur vide.");
      return;
    }

    if (query.username.length < 4) {
      res.status(400).json("Veuillez rentrer un nom d'utilisateur plus long.");
      return;
    }

    if (!validateEmail(query.email)) {
      res.status(400).json("Format d'email invalide.");
      return;
    }

    if (!validatePassword(query.password)) {
      res
        .status(400)
        .json(
          "Veuillez rentrer un mot de passe d'au moins 8 caractères comprenant au moins 1 majuscule, 1 minuscule, 1 chiffre ainsi qu'un caractère spécial"
        );
      return;
    }

    //#endregion

    //check if user already exists
    const checkEmailExist = await User.findOne({ email: query.email });
    const checkUsernameExist = await User.findOne({
      account: { username: query.username },
    });

    //if user does already exit, respond and exit
    if (checkEmailExist) {
      res.status(400).json("Un compte associé à cet email existe déjà.");
      return;
    }

    if (checkUsernameExist) {
      res
        .status(400)
        .json(
          "Ce nom d'utilisateur est déjà pris, veuillez en choisir un autre (de plus de 3 caractères)."
        );
      return;
    }

    //create new user, this won't trigger if an error was triggered before.

    const salt = uid2(16);

    const token = uid2(16);
    const hash = SHA256(query.password + salt).toString(encBase64);

    const newUser = new User({
      account: {
        username: query.username,
      },
      email: query.email,
      newsletter: query.newsletter,
      salt: salt,
      hash: hash,
      token: token,
    });

    newUser.account.avatar = {};
    newUser.account.avatar.secure_url = "";

    if (req.files.avatar) {
      const result = await cloudinary.uploader.upload(req.files.avatar.path, {
        folder: "vinted/avatars/",
        public_id: newUser.id,
      });
      newUser.account.avatar.secure_url = result.secure_url;
    }
    await newUser.save();

    res.json({
      _id: newUser.id,
      token: token,
      account: {
        username: query.username,
        avatar: { secure_url: newUser.account.avatar.secure_url },
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
//#endregion

//#region LOGIN
router.post("/user/login", async (req, res) => {
  try {
    const query = req.fields;

    const findUser = await User.findOne({ email: query.email });

    if (!findUser) {
      res
        .status(400)
        .json(
          "Le compte n'existe pas ou le mot de passe n'est pas le bon. \n Pour rappel votre mot de passe doit contenir 8 caractères comprenant au moins 1 majuscule, 1 minuscule, 1 chiffre ainsi qu'un caractère spécial."
        );
      return;
    }

    const checkPassword =
      SHA256(query.password + findUser.salt).toString(encBase64) ===
      findUser.hash
        ? true
        : false;

    if (checkPassword)
      res.json({
        _id: findUser.id,
        token: findUser.token,
        account: {
          username: findUser.account.username,
        },
      });
    else
      res
        .status(400)
        .json(
          "Le compte n'existe pas ou le mot de passe n'est pas le bon. \n Pour rappel votre mot de passe doit contenir 8 caractères comprenant au moins 1 majuscule, 1 minuscule, 1 chiffre ainsi qu'un caractère spécial."
        ); // eventuellement rappeler les regles de mot de passe (8 caracteres, 1 maj etc)
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
//#endregion

module.exports = router;
