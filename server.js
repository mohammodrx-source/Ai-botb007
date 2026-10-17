
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MX AI Backend is working!"
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    message: "Backend API is running",
    chatEndpoint: "/api/chat"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please provide a message."
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: "OPENAI_API_KEY is not configured in Render."
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are MX AI Assistant. Reply helpfully and clearly. Reply in Bengali when the user writes in Bengali."
            },
            {
              role: "user",
              content: message.trim()
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(502).json({
        success: false,
        error: "The AI service could not complete your request. Check the server logs and API configuration."
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    return res.json({
      success: true,
      reply: reply || "I couldn't generate a reply. Please try again."
    });
  } catch (error) {
    console.error("Chat error:", error.message);

    return res.status(500).json({
      success: false,
      error: "Internal server error."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MX AI Backend listening on port ${PORT}`);
});
