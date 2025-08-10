// src/integrations/shiprocket/client.ts

// Simple in-memory token cache. Works on Node 18+ (global fetch).
let cachedToken: { token: string; exp: number } | null = null

const BASE_URL =
  process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in"

export async function getShiprocketToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.exp > now + 30_000) {
    return cachedToken.token
  }

  // Prefer long-lived preset token if provided
  const preset = process.env.SHIPROCKET_TOKEN
  if (preset) {
    cachedToken = { token: preset, exp: now + 10 * 60 * 60 * 1000 } // ~10h cache
    return preset
  }

  const email = process.env.SHIPROCKET_EMAIL
  const password = process.env.SHIPROCKET_PASSWORD
  if (!email || !password) {
    throw new Error(
      "Shiprocket creds missing. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD or SHIPROCKET_TOKEN"
    )
  }

  const res = await fetch(`${BASE_URL}/v1/external/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Shiprocket login failed: ${res.status} ${t}`)
  }
  const data = (await res.json()) as { token: string }
  cachedToken = { token: data.token, exp: now + 10 * 60 * 60 * 1000 }
  return data.token
}

/**
 * Creates an adhoc order in Shiprocket.
 * Expects a payload already shaped to SR's fields.
 * Automatically injects channel_id if SHIPROCKET_CHANNEL_ID is set.
 */
export async function createShiprocketOrder(payload: any) {
  const token = await getShiprocketToken()

  // Auto-apply channel_id if available
  const ch = process.env.SHIPROCKET_CHANNEL_ID
  if (ch && typeof (payload as any).channel_id === "undefined") {
    ;(payload as any).channel_id = Number.isNaN(Number(ch)) ? ch : Number(ch)
  }

  const res = await fetch(`${BASE_URL}/v1/external/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Shiprocket order create failed: ${res.status} ${text}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}