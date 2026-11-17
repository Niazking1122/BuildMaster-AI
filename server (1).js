import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

async function askAI(instructions, input) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      instructions,
      input
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error?.message || "AI provider request failed.");
    err.status = response.status;
    throw err;
  }
  return (data.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === "output_text")
    .map(item => item.text)
    .join("\n");
}

app.post("/api/plan", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "Please provide a project idea." });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "AI is not configured yet. Add OPENAI_API_KEY to the server .env file." });
  }
  try {
    const text = await askAI(
      "You are BuildMaster AI, a friendly personal software architect. Reply in simple Roman Pashto when the user uses Pashto. Give a practical plan with scope, pages/features, architecture, milestones, risks, and the next concrete build step. Be honest about what is not implemented.",
      prompt
    );
    res.json({ text: text || "The AI returned no text." });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

function safeProjectFiles(parsed) {
  if (!parsed || !Array.isArray(parsed.files)) throw new Error("AI response did not contain a files array.");
  if (parsed.files.length < 1 || parsed.files.length > 30) throw new Error("Project must contain between 1 and 30 files.");
  const result = [];
  let totalBytes = 0;
  for (const file of parsed.files) {
    if (typeof file.path !== "string" || typeof file.content !== "string") throw new Error("Invalid generated file.");
    const normalized = file.path.replaceAll("\\", "/");
    if (normalized.startsWith("/") || normalized.split("/").some(part => part === ".." || part === "")) {
      throw new Error("Unsafe file path returned by AI.");
    }
    if (!/^[a-zA-Z0-9._/-]+$/.test(normalized)) throw new Error("Unsupported characters in generated file path.");
    const bytes = Buffer.byteLength(file.content, "utf8");
    totalBytes += bytes;
    if (bytes > 200_000 || totalBytes > 1_000_000) throw new Error("Generated project is too large.");
    result.push({ path: normalized, content: file.content });
  }
  if (new Set(result.map(f => f.path)).size !== result.length) throw new Error("Duplicate file paths returned.");
  return result;
}

app.post("/api/build", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "Please provide a project idea." });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "AI is not configured yet. Add OPENAI_API_KEY to the server .env file." });
  }
  try {
    const raw = await askAI(
      `You are BuildMaster AI, an expert software engineer. Create a small but useful first version of the user's requested software project.
Return ONLY valid JSON, no markdown fences, with this exact shape:
{"projectName":"short-kebab-case-name","summary":"short summary","files":[{"path":"relative/path.ext","content":"complete file content"}]}
Include all files needed for a runnable first prototype and a README with run instructions. Prefer a simple static HTML/CSS/JS app unless the request clearly needs a different stack. Do not include secrets, API keys, malware, credential theft, or destructive scripts. Keep paths relative and use at most 20 files. Reply with user-facing summary in simple Roman Pashto in the summary field when the user uses Pashto.`,
      prompt
    );
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned);
    const files = safeProjectFiles(parsed);
    const zip = new JSZip();
    for (const file of files) zip.file(file.path, file.content);
    const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const name = String(parsed.projectName || "buildmaster-project").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 48) || "buildmaster-project";
    res.json({
      projectName: name,
      summary: String(parsed.summary || "Your starter project is ready."),
      fileCount: files.length,
      files: files.map(f => f.path),
      zipBase64: archive.toString("base64")
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Could not build the project." });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`BuildMaster AI running at http://localhost:${port}`));
