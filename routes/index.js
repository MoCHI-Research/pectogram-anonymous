const express = require("express");
const router = express.Router();
const requireAuth = require("../auth/middleware");

const index_controller = require("../controllers/indexController");
const auth_controller = require("../controllers/authController");


/* GET home page.*/
router.get("/", function (req, res, next) {
  res.render("index", {
    title: "Pectograms",
    loggedIn: !!(req.session && req.session.userId), // true/false
  });
});

router.post("/generate", index_controller.prompt_post);

router.post("/tokenize", index_controller.prompt_tokenizer);

router.post("/save-prompt", requireAuth, index_controller.prompt_save);

router.get("/signup", auth_controller.render_signup);

router.post("/signup", auth_controller.handle_signup);

router.get("/login", auth_controller.render_login);

router.post("/login", auth_controller.handle_login);

router.get("/profile", requireAuth, auth_controller.render_profile);

router.get("/logout", auth_controller.handle_logout);

router.get("/upload-img", auth_controller.render_upload_img);

module.exports = router;
