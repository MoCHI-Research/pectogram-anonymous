const $saveButton = document.querySelector("#saveButton");
const tooltip = document.getElementById('tooltip');

async function handleSave() {
  // Grab current HTML content in card window.
  const rawSavedPrompt = $PECSGenerationWindow.innerHTML;
  if (rawSavedPrompt.length == 0) return;

  let image_pairs = [];

  // Format HTML content into image-label pairs and put it into an array
  document.querySelectorAll(".PECS-pair").forEach((image_pair) => {
    let originalUrl = image_pair.querySelector("img").src;
    let processedUrl = originalUrl;

    // Check if URL contains localhost:3000
    if (originalUrl.includes("localhost:3000")) {
      // Extract everything after localhost:3000/
      processedUrl = originalUrl.split("localhost:3000/")[1];
    }

    image_pairs.push({
      url: processedUrl,
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
  // Show tooltip
  tooltip.classList.remove('hidden');
  
  // Hide after 2 seconds
  setTimeout(() => {
    tooltip.classList.add('hidden');
  }, 2000);
});
