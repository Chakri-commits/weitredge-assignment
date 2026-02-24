require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { OpenAI } = require("openai");
const db = require("./db");
const docs = require("./docs.json");

const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
});

app.use(limiter);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Utility: Get last 5 pairs
function getRecentMessages(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT role, content FROM messages 
       WHERE session_id = ? 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [sessionId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.reverse());
      },
    );
  });
}

// Utility: Check docs
function searchDocs(question) {
  const lower = question.toLowerCase();
  const match = docs.find(
    (d) =>
      lower.includes(d.title.toLowerCase()) ||
      lower.includes(d.content.toLowerCase().split(" ")[0]),
  );
  return match;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: "Missing sessionId or message" });
    }

    db.run(`INSERT OR IGNORE INTO sessions (id) VALUES (?)`, [sessionId]);

    db.run(
      `INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)`,
      [sessionId, "user", message],
    );

    const relevantDoc = searchDocs(message);

    if (!relevantDoc) {
      const fallback = "Sorry, I don’t have information about that.";

      db.run(
        `INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)`,
        [sessionId, "assistant", fallback],
      );

      return res.json({ reply: fallback, tokensUsed: 0 });
    }

    const history = await getRecentMessages(sessionId);

    const prompt = `
You are a support assistant.

Answer ONLY using this documentation:
${relevantDoc.content}

If answer not in docs, say:
"Sorry, I don’t have information about that."

Chat History:
${history.map((h) => `${h.role}: ${h.content}`).join("\n")}

User: ${message}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const reply = completion.choices[0].message.content;

    db.run(
      `INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)`,
      [sessionId, "assistant", reply],
    );

    res.json({
      reply,
      tokensUsed: completion.usage.total_tokens,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/conversations/:sessionId", (req, res) => {
  db.all(
    `SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC`,
    [req.params.sessionId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    },
  );
});

app.get("/api/sessions", (req, res) => {
  db.all(`SELECT id, updated_at FROM sessions`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
