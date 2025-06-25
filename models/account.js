const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const Schema = mongoose.Schema;

const AccountSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  saved_prompts: [
    {
      type: Schema.Types.ObjectId,
      ref: "SavedPrompt",
    },
  ],
  saved_image_pairs: [
    {
      type: Schema.Types.ObjectId,
      ref: "ImagePair",
    },
  ],
});

// ======= AUTHENTICATION METHODS =======

// This is called a pre-hook. Before user info is saved in database,
// this function will be called
// Hash password before saving
AccountSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ======= VIRTUALS =========

module.exports = mongoose.model("Account", AccountSchema);
