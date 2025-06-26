const express = require("express");
const router = express.Router();
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");
const requireAuth = require("../auth/middleware");
const sharp = require("sharp");

const Account = require("../models/account");
const ImagePair = require("../models/image_pair");

// AWS S3 (DigitalOcean Spaces) Config - V3
const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_REGION}.digitaloceanspaces.com`,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
  forcePathStyle: false, // Important for DO Spaces
});

// Multer Config (unchanged)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1}, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed!"), false);
  },
});

router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  try {
    // Validate inputs (unchanged)
    if (!req.user) throw new Error("User not authenticated");
    if (!req.file) throw new Error("No image uploaded");
    if (!req.body.image_label?.trim()) throw new Error("Label is required");

    const label = req.body.image_label.trim();

    const resizedImage = await sharp(req.file.buffer)
      .resize({
        width: 256,
        withoutEnlargement: true,
      })
      .toBuffer();

    // Upload to DigitalOcean Spaces - V3 Style
    const uploadParams = {
      Bucket: process.env.DO_SPACES_NAME,
      Key: `users/${req.user._id}/${Date.now()}-${req.file.originalname}`,
      Body: resizedImage,
      ACL: "public-read",
      ContentType: req.file.mimetype,
    };

    // V3 Upload Process
    await s3Client.send(new PutObjectCommand(uploadParams));
    const fileUrl = `https://${process.env.DO_SPACES_NAME}.${process.env.DO_SPACES_REGION}.digitaloceanspaces.com/${uploadParams.Key}`;

    // Create and save image pair
    const newImagePair = await ImagePair.create({
      img_url: fileUrl, // Manually construct URL
      label: label,
      owner: req.user._id,
    });

    // Update user's account (unchanged)
    await Account.findByIdAndUpdate(req.user._id, {
      $push: { saved_image_pairs: newImagePair._id },
    });

    res.redirect("/profile");
  } catch (err) {
    console.error("Upload error:", err);

    let userMessage = err.message;
    if (err.message.includes("already exists")) {
      userMessage = `You already have an image labeled "${req.body.image_label}". Please choose a different label.`;
    }

    res.render("upload_img", {
      loggedIn: true,
      error: userMessage,
      previousValues: {
        label: req.body.image_label,
      },
    });
  }
});

// Add this new route to your existing backend file
router.delete("/:imageId", requireAuth, async (req, res) => {
  try {
    // Find the image pair
    const imagePair = await ImagePair.findById(req.params.imageId);
    if (!imagePair) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Verify ownership
    if (imagePair.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Extract key from DO Spaces URL
    const url = new URL(imagePair.img_url);
    const key = url.pathname.substring(1); // Remove leading slash

    // Delete from Digital Ocean Spaces
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.DO_SPACES_NAME,
        Key: key,
      })
    );

    // Delete from database
    await ImagePair.findByIdAndDelete(req.params.imageId);

    // Remove reference from user account
    await Account.findByIdAndUpdate(req.user._id, {
      $pull: { saved_image_pairs: req.params.imageId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

module.exports = router;
