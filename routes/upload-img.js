const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const multer = require("multer");
const requireAuth = require("../auth/middleware");

const Account = require("../models/account");
const ImagePair = require("../models/image_pair");

// AWS S3 (DigitalOcean Spaces) Config
const spacesEndpoint = new AWS.Endpoint(
  `${process.env.DO_SPACES_REGION}.digitaloceanspaces.com`
);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  signatureVersion: "v4", // Important for DO Spaces
});

// Multer Config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed!"), false);
  },
});

router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  try {
    // Validate inputs
    if (!req.user) throw new Error("User not authenticated");
    if (!req.file) throw new Error("No image uploaded");
    if (!req.body.image_label?.trim()) throw new Error("Label is required");

    const label = req.body.image_label.trim();

    // Upload to DigitalOcean Spaces
    const uploadParams = {
      Bucket: process.env.DO_SPACES_NAME,
      Key: `users/${req.user._id}/${Date.now()}-${req.file.originalname}`,
      Body: req.file.buffer,
      ACL: "public-read",
      ContentType: req.file.mimetype,
    };

    const uploadedFile = await s3.upload(uploadParams).promise();

    // Create and save image pair (schema validation will handle duplicates)
    const newImagePair = await ImagePair.create({
      img_url: uploadedFile.Location,
      label: label,
      owner: req.user._id,
    });

    // Update user's account
    await Account.findByIdAndUpdate(
      req.user._id, // Use _id instead of id for consistency
      { $push: { saved_image_pairs: newImagePair._id } }
    );

    res.redirect("/profile");
  } catch (err) {
    console.error("Upload error:", err);

    // Special handling for duplicate label
    let userMessage = err.message;
    if (err.message.includes("already exists")) {
      userMessage = `You already have an image labeled "${req.body.image_label}". Please choose a different label.`;
    }

    res.render("upload_img", {
      loggedIn: true,
      error: userMessage,
      // Preserve form input on error
      previousValues: {
        label: req.body.image_label,
      },
    });
  }
});

module.exports = router;
