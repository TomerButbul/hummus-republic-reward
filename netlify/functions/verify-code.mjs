import { json, store, isEduEmail, sha256 } from "./_shared.mjs"

const MAX_ATTEMPTS = 6

export default async (req) => {
  const origin = req.headers.get("origin")
  if (req.method === "OPTIONS") return json(204, {}, origin)
  if (req.method !== "POST") return json(405, { error: "method" }, origin)

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "bad_json" }, origin)
  }

  const email = isEduEmail(body?.email)
  const code = String(body?.code || "").trim()
  if (!email || !/^\d{6}$/.test(code))
    return json(400, { error: "bad_input" }, origin)

  const s = store()
  const key = await sha256(email)
  const rec = await s.get(key, { type: "json" }).catch(() => null)
  if (!rec) return json(400, { error: "no_code" }, origin)
  if (Date.now() > rec.expires) {
    await s.delete(key).catch(() => {})
    return json(400, { error: "expired" }, origin)
  }
  // Bounded guesses, so 6 digits can't be brute-forced.
  if ((rec.attempts || 0) >= MAX_ATTEMPTS) {
    await s.delete(key).catch(() => {})
    return json(429, { error: "too_many_attempts" }, origin)
  }

  const good = (await sha256(`${email}:${code}`)) === rec.codeHash
  if (!good) {
    await s.setJSON(key, { ...rec, attempts: (rec.attempts || 0) + 1 })
    return json(400, {
      error: "wrong_code",
      attemptsLeft: MAX_ATTEMPTS - ((rec.attempts || 0) + 1),
    }, origin)
  }

  await s.delete(key).catch(() => {})
  return json(200, { ok: true }, origin)
}
