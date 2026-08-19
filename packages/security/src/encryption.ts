import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

const envelopeSchema = z.object({
  v: z.literal(1),
  alg: z.literal("A256GCM+A256GCMKW"),
  keyIv: z.string(),
  wrappedKey: z.string(),
  keyTag: z.string(),
  dataIv: z.string(),
  ciphertext: z.string(),
  dataTag: z.string()
});

export type SecretEnvelope = z.infer<typeof envelopeSchema>;

function decodeMasterKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("ENVELOPE_MASTER_KEY must be a base64-encoded 32-byte key");
  return key;
}

function encryptAesGcm(key: Buffer, plaintext: Buffer, aad: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ciphertext, tag: cipher.getAuthTag() };
}

function decryptAesGcm(key: Buffer, iv: Buffer, ciphertext: Buffer, tag: Buffer, aad: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptSecret(secret: string, masterKeyBase64: string, context: string): string {
  const masterKey = decodeMasterKey(masterKeyBase64);
  const dataKey = randomBytes(32);
  const aad = Buffer.from(`routie:${context}`);
  const wrapped = encryptAesGcm(masterKey, dataKey, aad);
  const encrypted = encryptAesGcm(dataKey, Buffer.from(secret, "utf8"), aad);
  dataKey.fill(0);

  const envelope: SecretEnvelope = {
    v: 1,
    alg: "A256GCM+A256GCMKW",
    keyIv: wrapped.iv.toString("base64"),
    wrappedKey: wrapped.ciphertext.toString("base64"),
    keyTag: wrapped.tag.toString("base64"),
    dataIv: encrypted.iv.toString("base64"),
    ciphertext: encrypted.ciphertext.toString("base64"),
    dataTag: encrypted.tag.toString("base64")
  };
  return Buffer.from(JSON.stringify(envelope)).toString("base64url");
}

export function decryptSecret(serialized: string, masterKeyBase64: string, context: string): string {
  const envelope = envelopeSchema.parse(JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")));
  const masterKey = decodeMasterKey(masterKeyBase64);
  const aad = Buffer.from(`routie:${context}`);
  const dataKey = decryptAesGcm(
    masterKey,
    Buffer.from(envelope.keyIv, "base64"),
    Buffer.from(envelope.wrappedKey, "base64"),
    Buffer.from(envelope.keyTag, "base64"),
    aad
  );
  try {
    return decryptAesGcm(
      dataKey,
      Buffer.from(envelope.dataIv, "base64"),
      Buffer.from(envelope.ciphertext, "base64"),
      Buffer.from(envelope.dataTag, "base64"),
      aad
    ).toString("utf8");
  } finally {
    dataKey.fill(0);
  }
}
