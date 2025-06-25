const $saveButton = document.querySelector("#saveButton");

async function handleSave() {
  // Grab current HTML content in card window.
  const rawSavedPrompt = $PECSGenerationWindow.innerHTML;
  if (rawSavedPrompt.length == 0) return;

  let image_pairs = [];

  // Format HTML content into image-label pairs and put it into an array
  document.querySelectorAll(".PECS-pair").forEach((image_pair) => {
    image_pairs.push({
      url: image_pair.querySelector("img").src,
      label: image_pair.querySelector("label").innerText,
    });
  });

  // Send request to server
  let response = await fetch("/save-prompt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ saved_prompt: image_pairs }),
  });
}

$saveButton.addEventListener("click", async (e) => {
  handleSave();
});
