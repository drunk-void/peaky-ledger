import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const KEY_LENGTH = 32 // 256 bits

function getEncryptionKey(): Buffer {
  const hexKey = process.env.BROKER_TOKEN_ENCRYPTION_KEY
  if (!hexKey) {
    throw new Error('BROKER_TOKEN_ENCRYPTION_KEY environment variable is not defined')
  }
  const key = Buffer.from(hexKey, 'hex')
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be exactly ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars). Got ${key.length} bytes.`)
  }
  return key
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
  ciphertext += cipher.final('base64')
  
  const authTag = cipher.getAuthTag()
  
  // Format: iv_base64:authTag_base64:ciphertext_base64
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`
}

export function decrypt(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format. Must be iv:authTag:ciphertext')
  }
  
  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const ciphertext = Buffer.from(parts[2], 'base64')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let plaintext = decipher.update(ciphertext)
  plaintext = Buffer.concat([plaintext, decipher.final()])
  
  return plaintext.toString('utf8')
}
