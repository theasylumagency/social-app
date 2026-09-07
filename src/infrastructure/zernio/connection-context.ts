import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import type { ConnectionContextCipher, EncryptedConnectionContext } from "../../application/social-connections/connection-flow"
import { ConnectionFlowError } from "../../application/social-connections/connection-flow"

/** AES-GCM binds short-lived provider context to its exact UNDA intent. */
export function createConnectionContextCipher(encodedKey: string): ConnectionContextCipher {
  const key = Buffer.from(encodedKey, "base64")
  if (key.length !== 32 || key.toString("base64") !== encodedKey) throw new Error("Invalid connection context key")
  return {
    seal(value: string, intentId: string): EncryptedConnectionContext {
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, iv)
      cipher.setAAD(Buffer.from(intentId))
      return { iv, ciphertext: Buffer.concat([cipher.update(value, "utf8"), cipher.final()]), tag: cipher.getAuthTag() }
    },
    open(value, intentId) {
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, value.iv)
        decipher.setAAD(Buffer.from(intentId))
        decipher.setAuthTag(value.tag)
        return Buffer.concat([decipher.update(value.ciphertext), decipher.final()]).toString("utf8")
      } catch { throw new ConnectionFlowError("invalidFlow") }
    },
  }
}
