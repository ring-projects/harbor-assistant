import { createHash, randomBytes } from "node:crypto"

export function createSessionToken() {
  return randomBytes(32).toString("base64url")
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createOAuthState() {
  return randomBytes(24).toString("base64url")
}
