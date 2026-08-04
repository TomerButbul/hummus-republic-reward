import { getStore } from "@netlify/blobs"

/* Origins allowed to call these endpoints. Set ALLOWED_ORIGINS in Netlify to a
   comma-separated list; the defaults cover the Framer preview + live site. */
const DEFAULT_ORIGINS = [
  "https://thehummusrepublic.com",
  "https://www.thehummusrepublic.com",
  "https://particular-yards-508624.framer.app",
]

export const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .concat(DEFAULT_ORIGINS)

export const corsHeaders = (origin) => {
  const list = allowedOrigins()
  // Framer preview URLs are generated per-project, so allow *.framer.app too.
  const ok =
    origin &&
    (list.includes(origin) || /^https:\/\/[a-z0-9-]+\.framer\.app$/i.test(origin))
  return {
    "Access-Control-Allow-Origin": ok ? origin : list[0],
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  }
}

export const json = (status, body, origin) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) })

/* 204 means No Content — it MUST NOT carry a body, or the runtime throws and
   the preflight 502s, which silently blocks every browser request. */
export const noContent = (origin) =>
  new Response(null, { status: 204, headers: corsHeaders(origin) })

export const store = () => getStore({ name: "email-codes", consistency: "strong" })

/** Only .edu, and only a well-formed address. */
export const isEduEmail = (raw) => {
  const v = String(raw || "").trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.edu$/.test(v) ? v : null
}

/** Random 6-digit code, zero-padded, from a CSPRNG. */
export const makeCode = () => {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  return String(n).padStart(6, "0")
}

export const sha256 = async (s) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
