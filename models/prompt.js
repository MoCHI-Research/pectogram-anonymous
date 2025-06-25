const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const PromptSchema = new Schema({
  prompt: {
    type: String,
    required: true,
  },
  img_pair_array: [
    {
      label: { type: String },
      url: { type: String },
    },
  ],
  owner: { type: Schema.Types.ObjectId, ref: "Account", required: true },
});

// ======= START OF VIRTUALS =========

// ======= END OF VIRTUALS =========

module.exports = mongoose.model("SavedPrompt", PromptSchema);
