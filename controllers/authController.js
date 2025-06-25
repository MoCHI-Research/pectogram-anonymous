const Account = require("../models/account");
const ImagePair = require("../models/image_pair");
const Prompt = require("../models/prompt");

const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");

exports.render_signup = asyncHandler(async (req, res, next) => {
  // Check if user is already logged in
  if (req.session && req.session.userId) {
    return res.redirect("/profile"); // Redirect to profile if logged in
  }

  res.render("signup", {
    title: "Pectograms",
  });
});

exports.handle_signup = asyncHandler(async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    if (await Account.findOne({ username })) {
      return res.render("signup", {
        error: "Username already exists.",
      });
    }

    // Create new user
    const user = new Account({ username, password });
    await user.save();

    // Set session
    req.session.userId = user._id.toString();
    req.session.save((err) => {
      // Ensure session is saved
      if (err) {
        console.error("Session save error:", err);
        return res.redirect("/login?error=server-error");
      }
      res.redirect("/profile");
    });
  } catch (err) {
    return res.render("signup", {
      error: `An error occurred when signing up. Error: ${err}`,
    });
  }
});

exports.render_login = asyncHandler(async (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect("/profile"); // Redirect to profile if logged in
  }

  res.render("login", {
    title: "Pectograms",
  });
});

exports.handle_login = asyncHandler(async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await Account.findOne({ username });

    // Check user exists and password matches
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render("login", { error: "Invalid credentials" });
    }

    // Set session
    req.session.userId = user._id.toString();
    req.session.save((err) => {
      // Ensure session is saved
      if (err) {
        console.error("Session save error:", err);
        return res.redirect("/login?error=server-error");
      }
      res.redirect("/profile");
    });
  } catch (err) {
    res.render("login", {
      error: `An error occurred when logging in. Error: ${err}`,
    });
  }
});

exports.render_profile = asyncHandler(async (req, res, next) => {
  try {
    const user = await Account.findById(req.session.userId)
      .populate("saved_image_pairs") // Properly chain populate
      .exec();

    if (!user) {
      req.session.destroy(() => {
        // Destroy completes before redirect
        return res.redirect("/login");
      });
      return;
    }

    res.render("profile", {
      title: "Pectograms",
      username: user.username,
      loggedIn: true,
      image_pairs: user.saved_image_pairs || [],
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.redirect("/error");
  }
});

exports.handle_logout = asyncHandler(async (req, res, next) => {
  req.session.destroy((err) => {
    res.redirect("/login");
  });
});

exports.render_upload_img = asyncHandler(async (req, res, next) => {
  try {
    // Get user from session (no need to find by username/password)
    const user = await Account.findById(req.session.userId);

    if (!user) {
      // If user not found (deleted account but session exists)
      req.session.destroy();
      return res.redirect("/login");
    }

    res.render("upload_img", {
      title: "Pectograms",
      loggedIn: true,
    });
  } catch (err) {
    res.redirect("/login");
  }
});