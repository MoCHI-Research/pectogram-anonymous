const Account = require("../models/account");
const ImagePair = require("../models/image_pair");
const Prompt = require("../models/prompt");

const imagesDict = require("../python_preprocess/images.json");
const asyncHandler = require("express-async-handler");
const requireAuth = require("../auth/middleware");

const axios = require("axios");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");

const https = require("https");
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
});

function titleCase(s) {
  return s
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Configure Digital Ocean Spaces client
const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_REGION}.digitaloceanspaces.com`,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
  forcePathStyle: false, // Required for Digital Ocean Spaces
});

async function uploadToSpaces(imageBuffer, contentType) {
  if (!process.env.DO_SPACES_BUCKET) {
    throw new Error("DO_SPACES_BUCKET environment variable is not set");
  }

  const key = `dalle-images/${uuidv4()}.png`;

  const params = {
    Bucket: process.env.DO_SPACES_BUCKET, // Must be defined
    Key: key,
    Body: imageBuffer,
    ACL: "public-read",
    ContentType: contentType,
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    return `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_REGION}.digitaloceanspaces.com/${key}`;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

async function processDalleImage(url) {
  try {
    // Download the image
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });

    // Upload to Spaces
    const newUrl = await uploadToSpaces(
      response.data,
      response.headers["content-type"]
    );

    return newUrl;
  } catch (error) {
    console.error("Error processing DALL·E image:", error);
    return url; // Return original if fails
  }
}

// Request prompt save
exports.prompt_save = asyncHandler(async (req, res, next) => {
  let whole_label = "";

  // Process each image pair
  const processedPairs = await Promise.all(
    req.body.saved_prompt.map(async (pair) => {
      whole_label += ` ${pair.label}`;

      // Check for DALL·E URL
      if (pair.url.startsWith("https://oaidalleapiprodscus")) {
        const newUrl = await processDalleImage(pair.url);
        return { ...pair, url: newUrl };
      }
      return pair;
    })
  );

  const newSavedPrompt = await Prompt.create({
    prompt: whole_label,
    img_pair_array: processedPairs, // Use processed pairs
    owner: req.user._id,
  });

  await Account.findByIdAndUpdate(req.user._id, {
    $push: { saved_prompts: newSavedPrompt._id },
  });

  res.status(201).json({
    success: true,
    data: newSavedPrompt,
  });
});

// Request prompt deletion
exports.prompt_delete = asyncHandler(async (req, res, next) => {
  try {
    // Find the image pair
    const savedPrompt = await Prompt.findById(req.params.promptId);
    if (!savedPrompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }

    // Verify ownership
    if (savedPrompt.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Delete from database
    await Prompt.findByIdAndDelete(req.params.promptId);

    // Remove reference from user account
    await Account.findByIdAndUpdate(req.user._id, {
      $pull: { saved_prompts: req.params.promptId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete prompt" });
  }
});

// Request prompt generation
exports.prompt_tokenizer = asyncHandler(async (req, res, next) => {
  let ai_prompt = `Take a users sentence and break it into key words and phrases. Then give keys for image labling sepparated by a semi-colon.
                     There should always be the same number of tokens and labels.
                     Labels should include all words from the original sentence.

                    Example 1
                    User: I want pasta for dinner
                    Model: I want | pasta | dinner; I want | pasta | for dinner
                    
                    Example 2
                    User: The red apple is yummy
                    Model: red apple | yummy; The red apple | is yummy
                    
                    Example 3
                    User: No running in the hall
                    Model: no | running | hall; No | running | in the hall

                    Example 4
                    User: I want mint chocolate chip ice cream
                    Model: I want | mint chocolate chip ice cream; I want | mint chocolate chip ice cream
                    
                    User Sentence: ${req.body.prompt}
                    Model:`;

  let response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input: ai_prompt,
    }),
  });

  let readableResponse = await response.json();
  let finalAnswer = readableResponse.output[0].content[0].text.split("; ");
  res.send(finalAnswer);
});

exports.prompt_post = asyncHandler(async (req, res, next) => {
  if (req.user) {
    const user = await Account.findById(req.session.userId)
      .populate({
        path: "saved_image_pairs",
        select: "img_url label", // Only get needed fields
      })
      .exec();

    // Case-insensitive search with trimmed comparison
    const matchingImage = user.saved_image_pairs.find(
      (pair) =>
        pair.label.trim().toLowerCase() === req.body.word.trim().toLowerCase()
    );

    if (matchingImage) {
      return res.json({
        success: true,
        url: matchingImage.img_url,
        source: "user-saved",
        label: matchingImage.label,
      });
    }
  }

  // using python, check in phrase is "close enough" to any of the PECS
  // python should return closest key in images.json or original phrase
  let phrase = titleCase(req.body.word);
  if (imagesDict.hasOwnProperty(phrase) && !req.body.isRegen)
    return res.json({ url: `images/${imagesDict[phrase]}` });

  try {
    // Validate input
    if (!req.body.prompt || typeof req.body.prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Prompt is required and must be a string",
      });
    }

    const engineered_prompt = req.body.prompt.trim();
    if (engineered_prompt.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Prompt cannot be empty",
      });
    }

    // Validate prompt length (DALL-E 2 has 4000 character limit)
    if (engineered_prompt.length > 4000) {
      return res.status(400).json({
        success: false,
        error: "Prompt exceeds maximum length of 4000 characters",
      });
    }

    // API request with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    let response_img;
    try {
      response_img = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            Connection: "keep-alive",
          },
          body: JSON.stringify({
            model: "dall-e-2",
            prompt: engineered_prompt,
            n: 1,
            size: "256x256",
            response_format: "url",
          }),
          agent: agent,
          signal: controller.signal,
        }
      );
    } catch (err) {
      if (err.name === "AbortError") {
        return res.status(504).json({
          success: false,
          error: "Request to OpenAI API timed out",
        });
      }
      throw err; // Re-throw other errors
    } finally {
      clearTimeout(timeout);
    }

    // Handle API response errors
    if (!response_img.ok) {
      let errorData;
      try {
        errorData = await response_img.json();
      } catch (e) {
        errorData = { error: "Failed to parse error response" };
      }

      return res.status(response_img.status).json({
        success: false,
        error: errorData.error?.message || "Failed to generate image",
        details: errorData,
      });
    }

    // Process successful response
    let img_data;
    try {
      img_data = await response_img.json();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to parse OpenAI response",
      });
    }

    // Validate response structure
    if (!img_data.data || !Array.isArray(img_data.data)) {
      return res.status(500).json({
        success: false,
        error: "Invalid response format from OpenAI",
        response: img_data,
      });
    }

    const firstImage = img_data.data[0];
    if (!firstImage?.url) {
      return res.status(500).json({
        success: false,
        error: "No image URL in response",
        response: img_data,
      });
    }

    // Success response
    res.json({
      success: true,
      url: firstImage.url,
      prompt: engineered_prompt,
      model: "dall-e-2",
    });
  } catch (error) {
    console.error("Error in prompt_post:", error);

    // Handle specific error cases
    if (error.message.includes("API key")) {
      return res.status(401).json({
        success: false,
        error: "Invalid OpenAI API key configuration",
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
