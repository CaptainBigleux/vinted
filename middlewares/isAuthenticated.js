const User = require("../models/User");

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

module.exports = isAuthenticated;
