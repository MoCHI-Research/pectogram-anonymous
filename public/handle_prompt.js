// Globals
const promptStack = [];
let is_running = false;

// DOM Constants
const $generateButton = document.querySelector("#generateButton");
const $prevButton = document.querySelector("#previousButton");
const $generatePrompt = document.querySelector("#generatePrompt");
const $PECSGenerationWindow = document.querySelector("#PECSGenerator");
const $regenButton = document.querySelector("#toggle");

// Functions
async function get_PECS(phrase) {
  try {
    const response = await fetch("/nlp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json", // Explicitly ask for JSON
      },
      body: JSON.stringify({ input: phrase }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error in get_PECS function:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

function injectImageIntoHTML(pair, before_words) {
  // Generates HTML elements for each image/word pair and injects it
  let pair_HTML = `
        <div class="PECS-pair">
            <img alt="${pair.word}" src="${pair.img}">
            <label>${before_words}</label>
        </div>
    `;
  $PECSGenerationWindow.insertAdjacentHTML("beforeend", pair_HTML);
}

function splitOn(targetWord, str) {
  const words = str.trim().split(/\s+/);
  const targetIndex = words.findIndex(
    (word) => word.toLowerCase() === targetWord.toLowerCase()
  );

  if (targetIndex === -1) {
    return [str, ""]; // If word not found, return full string & empty
  }

  // Include target word in the "before" part
  return [
    words.slice(0, targetIndex + 1).join(" "), // Before + target word
    words.slice(targetIndex + 1).join(" "), // After target word
  ];
}

function injectPrev() {
  if (is_running) return;

  // Clear previous images
  $PECSGenerationWindow.innerHTML = "";
  if (promptStack.length == 0) return;
  $PECSGenerationWindow.insertAdjacentHTML("beforeend", promptStack.pop());
}

async function generateImageForWord(word, isRegen=false) {
  // console.log(`Generating image for ${word}...`)

  let engineered_prompt = `Create a bright, simple, and engaging image of: '${word}'.
    Focus on Clarity: Highlight the key action or object 
    Child-Friendly Style: Use bold outlines, vibrant colors, and minimal background distractions.
    Context Matters: Ensure the image matches the intended meaning 
    Keep It Literal: Avoid metaphors or complex symbols—prioritize instant recognition.
    The image should be inclusive, culturally neutral, and appealing to young learners.
    `;

  // This is the request to the server using fetch
  let init_img = await fetch("/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: engineered_prompt, word: word, isRegen: isRegen}),
  });

  // Retrieves the url (which is only valid for 60 minutes)
  let img_value = await init_img.json();
  let img_url = img_value.url;

  // Put the image and word in a pair
  let image_word_dict = {
    word,
    img: img_url,
  };

  return image_word_dict;
}

async function preprocessPrompt(prompt) {
  let tokenized_prompt = await fetch("/tokenize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: prompt }),
  });

  let translated_tokenized_prompt = await tokenized_prompt.json();

  console.log(translated_tokenized_prompt);
  return translated_tokenized_prompt;
}

async function generateImages(keywords, prompt) {
  // Run concurrently (to increase speed)
  const imagePromises = keywords.map((word) => generateImageForWord(word));
  return Promise.all(imagePromises); // Wait for all to finish
}

async function regenImage(word, generatedPICS) {
  if (generatedPICS.src != null) {
    return (new_image = await generateImageForWord(word, true));
  }
}

function handleRegenCall() {
  let $generatedPICS = document.querySelectorAll(".PECS-pair img");
  for (let i = 0; i < $generatedPICS.length; i++) {
    $generatedPICS[i].addEventListener("click", async (e) => {
      if (!$regenButton.checked) return;
      $generatedPICS[i].src = "loading.gif";
      let replacementImage = await regenImage(
        $generatedPICS[i].alt,
        $generatedPICS[i]
      );
      $generatedPICS[i].src = replacementImage.img;
    });
  }
}

async function handlePrompt() {
  // Take content from input field and store it
  let prompt = $generatePrompt.value;

  if (prompt.length == 0) return;
  is_running = true;

  // Clear input field
  $generatePrompt.value = "";

  // Disable input field while working
  $generatePrompt.setAttribute("disabled", "");
  $generatePrompt.setAttribute("placeholder", "Working...");

  // Push into promptStack the current contents.
  promptStack.push($PECSGenerationWindow.innerHTML);

  // Clear previous images
  $PECSGenerationWindow.innerHTML = "";

  // Set generator background to a loading gif
  $PECSGenerationWindow.title = "Loading GIF";
  $PECSGenerationWindow.style.backgroundImage = "url(loading.gif)";

  // Call keywords finding
  const ai_tokenization = await preprocessPrompt(prompt);
  let keywords = ai_tokenization[0].split(" | ");
  let lables = ai_tokenization[1].split(" | ");

  // Adjust keywords as needed
  let final_keywords = [];
  for (let i = 0; i < keywords.length; i++) {
    let j = await get_PECS(keywords[i]);
    final_keywords.push(j.top_match);
  }

  // Call image generation
  let all_pairs = await generateImages(final_keywords, prompt);

  for (let i = 0; i < lables.length; i++) {
    injectImageIntoHTML(all_pairs[i], lables[i]);
  }

  // Reset background
  $PECSGenerationWindow.title = "";
  $PECSGenerationWindow.style.backgroundImage = "none";

  // Enable input field after done
  $generatePrompt.removeAttribute("disabled");
  $generatePrompt.setAttribute("placeholder", "Example: The apple is red.");

  is_running = false;

  // Call regenImage
  handleRegenCall();
}

// Event Listeners
$prevButton.addEventListener("click", async (e) => {
  injectPrev();
});

$generateButton.addEventListener("click", async (e) => {
  handlePrompt();
});

$generatePrompt.addEventListener("keydown", async (e) => {
  if (e.key == "Enter") {
    handlePrompt();
  }
});
