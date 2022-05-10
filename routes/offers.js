const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;

const Offer = require("../models/Offer");
const User = require("../models/User");

//On vient paramétrer cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

//#region Authenticated & Custom methods
//middleware function to check if user is authenticated before allowing him to post offer
const isAuthenticated = async (req, res, next) => {
  try {
    const checkUser = await User.findOne({
      token: req.headers.authorization.replace("Bearer ", ""),
    });
    if (checkUser) {
      req.user = checkUser;
      return next();
    } else return res.status(400).json("Unauthorized");

    // req.user =
  } catch (error) {
    res.json(error);
  }
};

const validateInputs = (type, content) => {
  switch (type) {
    case "description":
      if (content.length > 500)
        return res
          .status(400)
          .json("La description doit faire moins de 500 caractères.");
    case "title":
      if (content.length > 50)
        return res
          .status(400)
          .json("Le titre doit faire moins de 50 caractères.");
    case "price":
      if (content > 10000)
        return res.status(400).json("Le prix doit être inférieur à 100000.");
  }
};

//#endregion

//#region SHOWOFFERS
router.get("/offers", async (req, res) => {
  try {
    const { page, priceMin, priceMax, title, sort } = req.query;

    const numberOfOffers = await Offer.countDocuments();
    const resultPerPage = 10;
    const totalNumberOfPages = Math.ceil(numberOfOffers / resultPerPage);
    const currentPage = page ? page : 1;

    //autre possibilité: construire un filtre (objet) en fonction des queries passées et le passeer a find()
    const newPriceMin = priceMin ? priceMin : 0;
    const newPriceMax = priceMax ? priceMax : Infinity;
    const newSort = sort ? sort : "price-desc";

    const offers = await Offer.find({
      product_name: new RegExp(title, "i"),
      product_price: {
        $gte: newPriceMin,
        $lte: newPriceMax,
      },
    })
      .limit(resultPerPage)
      .skip((currentPage - 1) * resultPerPage)
      .sort({ product_price: newSort.replace("price-", "") }) //newSort is undefined ?! how TODO
      .populate("owner", "-hash -token -salt")
      .select();

    const numberOfFilteredOffers = await Offer.countDocuments(offers);
    const numberOfFilteredPages = Math.ceil(
      numberOfFilteredOffers / resultPerPage
    );

    return res.json({
      offers,
      totalOffersCount: numberOfOffers,
      filteredOffersCount: numberOfFilteredOffers,
      totalNumberOfPages: totalNumberOfPages,
      numberOfFilteredPages: numberOfFilteredPages,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
//#endregion

//#region SHOWOFFER WITH ID PARAMS
router.get("/offer/:id", async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate("owner", "-hash -token -salt") // ou .populate({path: "owner", select: "account.username email -_id"})
      .select();

    res.json(offer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

//#endregion

//#region PUBLISH
router.post("/offer/publish", isAuthenticated, async (req, res) => {
  try {
    const {
      product_description,
      product_name,
      product_price,
      brand,
      condition,
      size,
      color,
      city,
    } = req.fields;

    validateInputs("description", product_description);
    validateInputs("title", product_name);
    validateInputs("price", product_price);

    const newOffer = new Offer({
      product_name: product_name,
      product_description: product_description,
      product_price: product_price,
      product_details: [
        { MARQUE: brand },
        { ETAT: condition },
        { TAILLE: size },
        { COULEUR: color },
        { EMPLACEMENT: city },
      ],
    });
    newOffer.owner = req.user.id;
    await newOffer.populate("owner");

    if (!req.files.product_image) {
      return res.json({
        message: "Au moins une image est requise pour créer une offre.",
      });
    }

    newOffer.product_pictures = [];

    for (let i = 0; i < req.files.product_pictures.length; i++) {
      const result = await cloudinary.uploader.upload(
        req.files.product_image.path,
        {
          folder: `vinted/offers/${newOffer._id}`,
          public_id: newOffer.product_name + "-" + i, // correction différente, a check. Bastien mets `${req.fields.title} - ${newOffer._id}`
        }
      );
      newOffer.product_pictures.push(result);
    }
    console.log("loopgood");
    // //upload image
    // const result = await cloudinary.uploader.upload(
    //   req.files.product_image.path,
    //   {
    //     folder: `vinted/offers/${newOffer.id}`,
    //     public_id: newOffer.product_name, // correction différente, a check. Bastien mets `${req.fields.title} - ${newOffer._id}`
    //   }
    // );
    console.log("product pictures => ", newOffer.product_pictures);
    newOffer.product_image = newOffer.product_pictures[0];
    // newOffer.product_image = result.secure_url;
    await newOffer.save();

    return res.json({
      _id: newOffer._id,
      product_name: newOffer.product_name,
      product_description: newOffer.product_description,
      product_price: newOffer.product_price,
      product_details: newOffer.product_details,
      owner: {
        account: {
          // newOffer.owner.account ça doit fonctionner
          username: newOffer.owner.account.username,
          avatar: newOffer.owner.account.avatar,
        },
        _id: newOffer.owner._id,
      },
      product_image: { secure_url: newOffer.product_image.secure_url },
      product_pictures: newOffer.product_pictures,
    });
  } catch (error) {
    return res.json({ error: error.message });
  }
});
//#endregion

//#region MODIFY A TESTER
//Je pars du principe que j'ai l'id de l'offre. Si ce n'est pas le cas, il faudrait find les offres associées a l'user
//puis parmis ces offres rechercher le nom de l'offre (+ éventuellement d'autres criteres)
router.put("/offer/modify", isAuthenticated, async (req, res) => {
  try {
    // const offersAssociatedWithUser = await Offer.find({ owner: req.user.id }); // toutes les offres associées à l'user
    const { product_description, product_name, product_price, _id } =
      req.fields;
    product_description
      ? validateInputs("description", product_description)
      : null;
    product_name ? validateInputs("title", product_name) : null;
    product_price ? validateInputs("price", product_price) : null;

    const offerToUpdate = await Offer.findById(_id);

    const nameChange = req.fields.product_name
      ? req.fields.product_name
      : offerToUpdate.product_name;

    for (const key in req.fields) {
      offerToUpdate[key] = req.fields[key];
    }

    // si req.files n'est pas nul, la personne veut MAJ ou ajouter des photos
    //en front, envoyer req files uniquement si ya changement. si oui reupload toutes les photos.
    if (req.files) {
      await cloudinary.api.delete_all_resources(`/vinted/offers/${_id}`);

      for (let i = 0; i < req.files.length; i++) {
        await cloudinary.uploader.upload(req.files[i].product_image.path, {
          folder: `vinted/offers/${_id}`,
          public_id: nameChange,
        });
      }
    }
    await offerToUpdate.save();

    res.json("Offre modifiée avec succès.");
  } catch (error) {
    res.json(error);
  }
});
//#endregion

//#region DELETE
router.delete("/offer/delete", isAuthenticated, async (req, res) => {
  try {
    const { _id } = req.fields;
    const result = await Offer.deleteOne({ _id: _id });

    if (result.deletedCount === 0) {
      return res
        .status(400)
        .json("L'offre n'existe pas. Impossible de la supprimer.");
    }

    // await cloudinary.uploader.destroy(`vinted/offers/${req.fields.id}`); pour détruire une image en particulier
    await cloudinary.api.delete_all_resources(
      `/vinted/offers/${req.fields.id}`
    );

    await cloudinary.api.delete_folder(`/vinted/offers/${_id}`);

    res.json("Offre supprimée avec succès.");
  } catch (error) {
    res.json(error);
  }
});
//#endregion

module.exports = router;
