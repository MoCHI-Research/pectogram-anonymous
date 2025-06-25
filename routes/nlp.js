const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");

router.post("/", async (req, res) => {
  try {
    // Validate input
    if (!req.body.input) {
      return res.status(400).json({ error: "Missing input string" });
    }

    const pythonScriptPath = path.join(
      __dirname,
      "..",
      "python_preprocess",
      "preprocess.py"
    );
    const pythonExecutable = path.join(
      __dirname,
      "..",
      "venv",
      "bin",
      "python3"
    );

    // Spawn Python process using venv Python
    const pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Send input as JSON
    pythonProcess.stdin.write(req.body.input);
    pythonProcess.stdin.end();

    let result = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python Error (code ${code}): ${errorOutput}`);
        return res.status(500).json({
          error: "Python processing failed",
          details: errorOutput,
        });
      }

      try {
        // Parse the JSON response
        const parsed = JSON.parse(result);
        res.json(parsed);
      } catch (e) {
        console.error("JSON Parse Error:", e);
        res.status(500).json({
          error: "invalid_python_output",
          details: "Python returned invalid JSON",
        });
      }
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
});

module.exports = router;
