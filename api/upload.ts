// api/upload.ts
export const config = {
  runtime: 'edge',
};

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

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function uploadToGitHub(filename: string, contentBase64: string) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
  const OWNER = process.env.OWNER!;
  const REPO = process.env.REPO!;
  const BRANCH = process.env.BRANCH!;

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

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Not Found", { status: 404 });
  }

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
  const base64 = arrayBufferToBase64(arrayBuffer);

  try {
    const publicUrl = await uploadToGitHub(newFilename, base64);
    return new Response(JSON.stringify({ url: publicUrl, filename: newFilename }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

