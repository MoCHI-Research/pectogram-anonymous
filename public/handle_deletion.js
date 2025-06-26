async function deleteImage(imageId) {
  if (!confirm("Are you sure you want to delete this image?")) return;

  try {
    const response = await fetch(`/upload-img/${imageId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      // Refresh the page to show changes
      window.location.reload();
    } else {
      const error = await response.json();
      alert(error.error || "Failed to delete image");
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("Network error - please try again");
  }
}

async function deletePrompt(promptId) {
  if (!confirm("Are you sure you want to delete this prompt?")) return;
  try {
    const response = await fetch(`/delete-prompt/${promptId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      // Refresh the page to show changes
      window.location.reload();
    } else {
      const error = await response.json();
      alert(error.error || "Failed to delete image");
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("Network error - please try again");
  }
}

function enlargePrompt(promptId) {
  const dialog = document.querySelector(".expanded-prompt-modal");
  const dialog_content = document.querySelector("dialog div");
  const ogDiv = document.querySelector(`#prompt_${promptId}`);

  const divCopy = ogDiv.cloneNode(true);
  divCopy.querySelectorAll("button").forEach((button) => {
    button.remove();
  });
  const cleanedHtml = divCopy.innerHTML;

  dialog_content.innerHTML = cleanedHtml;
  dialog.showModal();

  // "Close" button closes the dialog
  const closeButton = document.querySelector("dialog button");
  closeButton.addEventListener("click", () => {
    dialog.close();
  });
}
