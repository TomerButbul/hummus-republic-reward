import { json, noContent, store, isEduEmail, makeCode, sha256 } from "./_shared.mjs"

const CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const RESEND_MAX_PER_EMAIL = 5 // per hour
const RESEND_WINDOW_MS = 60 * 60 * 1000

export default async (req) => {
  const origin = req.headers.get("origin")
  if (req.method === "OPTIONS") return noContent(origin)
  if (req.method !== "POST") return json(405, { error: "method" }, origin)

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "bad_json" }, origin)
  }

  const email = isEduEmail(body?.email)
  if (!email) return json(400, { error: "not_edu" }, origin)

  const s = store()
  const key = await sha256(email)

  // Throttle per address so this can't be used to mail-bomb a student.
  const existing = await s.get(key, { type: "json" }).catch(() => null)
  const now = Date.now()
  if (existing && now - (existing.windowStart || 0) < RESEND_WINDOW_MS) {
    if ((existing.sends || 0) >= RESEND_MAX_PER_EMAIL)
      return json(429, { error: "too_many" }, origin)
  }

  const code = makeCode()
  const record = {
    codeHash: await sha256(`${email}:${code}`),
    expires: now + CODE_TTL_MS,
    attempts: 0,
    sends:
      existing && now - (existing.windowStart || 0) < RESEND_WINDOW_MS
        ? (existing.sends || 0) + 1
        : 1,
    windowStart:
      existing && now - (existing.windowStart || 0) < RESEND_WINDOW_MS
        ? existing.windowStart
        : now,
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM || "Hummus U+ <rewards@mail.thehummusrepublic.com>"
  if (!apiKey) return json(500, { error: "no_api_key" }, origin)

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} is your Hummus U+ code`,
      text: `Your Hummus U+ verification code is ${code}. It expires in 10 minutes.`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:440px;margin:0 auto;padding:28px 24px;background:#FEFBFA;color:#271214">
  <div style="font-size:13px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#1C392F">Hummus U+</div>
  <h1 style="font-size:22px;color:#1C392F;margin:14px 0 6px">Verify your school email</h1>
  <p style="font-size:15px;line-height:1.55;color:#5C5049;margin:0 0 22px">Enter this code to finish joining Hummus U+ Rewards.</p>
  <div style="font-size:38px;font-weight:800;letter-spacing:9px;color:#1C392F;background:#EBE2D9;border-radius:12px;padding:18px;text-align:center">${code}</div>
  <p style="font-size:13px;line-height:1.55;color:#5C5049;margin:20px 0 0">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
</div>`,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    return json(502, { error: "send_failed", detail: detail.slice(0, 300) }, origin)
  }

  await s.setJSON(key, record)
  return json(200, { ok: true, expiresIn: CODE_TTL_MS / 1000 }, origin)
}
