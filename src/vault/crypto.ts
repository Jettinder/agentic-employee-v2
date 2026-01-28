import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
const ALG = 'aes-256-gcm';
function getKey(): Buffer {
  const raw = process.env.VAULT_KEY || 'dev-demo-key-please-change-32bytes!!!!';
  const h = createHash('sha256').update(raw).digest();
  return h; // 32 bytes
}
export function encrypt(plain: string){
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
}
export function decrypt(payload: { iv: string; tag: string; data: string }){
  const key = getKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}
