// Seed a batch of demo businesses through the admin commission endpoint.
// Usage: NEXT_PUBLIC_APP_URL=... ADMIN_SECRET=... node scripts/seed-demo.mjs

const APP = process.env.NEXT_PUBLIC_APP_URL;
const SECRET = process.env.ADMIN_SECRET;
if (!APP || !SECRET) {
  console.error("Set NEXT_PUBLIC_APP_URL and ADMIN_SECRET");
  process.exit(1);
}

const prompts = [
  "An AI that writes Shakespearean haikus about any topic",
  "A code roaster that drags your JavaScript with brutal honesty",
  "An emoji-only translator for business English",
  "A startup name generator with witty taglines",
  "An AI that gives bitter life advice as if written by a Victorian ghost",
  "A pitch-deck one-liner generator for ambitious founders",
  "A mock-interview AI for software engineering questions",
  "A children's bedtime story generator featuring brave cats",
  "An AI that invents new cocktails with emoji recipes",
  "A product description writer for handmade Etsy shops",
  "An AI that roasts a Twitter bio with brutal affection",
  "A one-line movie pitch generator for weird sci-fi",
];

for (const p of prompts) {
  try {
    const r = await fetch(`${APP}/api/admin/commission`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Secret": SECRET },
      body: JSON.stringify({ prompt: p }),
    });
    const j = await r.json();
    console.log(p, "→", j.commissionId ?? j.error);
  } catch (e) {
    console.error(p, "FAIL:", e.message);
  }
}
