const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const ImagePairSchema = new Schema({
  img_url: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
    validate: {
      validator: async function (label) {
        const existing = await this.constructor.findOne({
          _id: { $ne: this._id }, // Exclude current doc
          owner: this.owner,
          label: label,
        });
        return !existing;
      },
      message: (props) => `Label "${props.value}" already exists`,
    },
  },
  owner: { type: Schema.Types.ObjectId, ref: "Account", required: true },
});

// ======= START OF VIRTUALS =========

// ======= END OF VIRTUALS =========

module.exports = mongoose.model("ImagePair", ImagePairSchema);
