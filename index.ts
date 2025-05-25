import { serve } from "bun";

const GITHUB_TOKEN = Bun.env.GITHUB_TOKEN;
const OWNER = Bun.env.OWNER;
const REPO = Bun.env.REPO;
const BRANCH = Bun.env.BRANCH;
const PORT = Number(Bun.env.PORT) || 3000;

function addTimestampToFilename(filename: string) {
  const date = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");

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

async function uploadToGitHub(filename: string, contentBase64: string) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/uploads/${filename}`;

  // Karena nama file sudah unik, kita anggap file belum ada jadi skip cek sha

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

console.log("Starting server on http://localhost:" + PORT);

serve({
  port: PORT,
  async fetch(req) {
    if (req.method === "POST" && new URL(req.url).pathname === "/upload") {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(JSON.stringify({ error: "No file uploaded" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const newFilename = addTimestampToFilename(file.name);

      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      try {
        const publicUrl = await uploadToGitHub(newFilename, base64);
        return new Response(
          JSON.stringify({ url: publicUrl, filename: newFilename }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response("Not Found", { status: 404 });
  },
});
