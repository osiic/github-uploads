import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import nextConnect from "next-connect";

dotenv.config();

const upload = multer();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const BRANCH = process.env.BRANCH;

function addTimestampToFilename(filename) {
  const date = new Date();
  const pad = (n) => n.toString().padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  const timestamp = `${yyyy}${mm}${dd}T${hh}${min}${ss}`;

  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return `${filename}-${timestamp}`;
  const name = filename.slice(0, lastDot);
  const ext = filename.slice(lastDot);

  return `${name}-${timestamp}${ext}`;
}

async function uploadToGitHub(filename, contentBase64) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/uploads/${filename}`;

  const body = {
    message: `Upload ${filename}`,
    content: contentBase64,
    branch: BRANCH,
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub upload failed: ${err}`);
  }

  const json = await res.json();
  return json.content.download_url;
}

// Buat nextConnect instance
const handler = nextConnect();

// Endpoint GET /api/upload => cek server hidup
handler.get((req, res) => {
  res.status(200).json({ status: "ok", message: "Upload API is running" });
});

// POST /api/upload => upload file
handler.post(async (req, res) => {
  await new Promise((resolve, reject) => {
    upload.single("file")(req, {}, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const newFilename = addTimestampToFilename(req.file.originalname);
  const base64 = req.file.buffer.toString("base64");

  try {
    const url = await uploadToGitHub(newFilename, base64);
    res.status(200).json({ url, filename: newFilename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default function(req, res) {
  if (req.url === "/" && req.method === "GET") {
    // GET / => cek server hidup
    return res.status(200).send("Server is alive");
  }

  // Semua request selain /api/upload di-handle nextConnect
  if (req.url.startsWith("/api/upload")) {
    return handler(req, res);
  }

  // Kalau bukan itu, return 404
  res.status(404).json({ error: "Not Found" });
}

