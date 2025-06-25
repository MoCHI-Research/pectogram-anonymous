const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const PromptSchema = new Schema({
  prompt: {
    type: String,
    required: true,
  },
  img_pair_array: [
    {
      type: Schema.Types.ObjectId,
      ref: "ImagePair",
    },
  ],
});

// ======= START OF VIRTUALS =========

// ======= END OF VIRTUALS =========

module.exports = mongoose.model("SavedPrompt", PromptSchema);
