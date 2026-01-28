import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { encrypt, decrypt } from './crypto.js';

export interface SecretVersion { id: string; createdAt: string; enc: { iv: string; tag: string; data: string } }
export interface Secret { id: string; name: string; scopes: string[]; versions: SecretVersion[]; revoked: boolean; revokedAt?: string }
export interface VaultState { secrets: Secret[] }

const PATH = '.data/vault.json';

function load(): VaultState { try { const txt = readFileSync(PATH, 'utf8'); return JSON.parse(txt); } catch { return { secrets: [] }; } }
function save(state: VaultState){ if(!existsSync('.data')) mkdirSync('.data'); writeFileSync(PATH, JSON.stringify(state, null, 2)); }
function uid(){ return 'sec_'+Math.random().toString(36).slice(2); }

export function addSecret(name: string, value: string, scopes: string[]): Secret {
  const state = load();
  const s: Secret = { id: uid(), name, scopes, revoked: false, versions: [] };
  const ver: SecretVersion = { id: uid(), createdAt: new Date().toISOString(), enc: encrypt(value) };
  s.versions.push(ver);
  state.secrets.push(s);
  save(state);
  return s;
}
export function listSecrets(): Omit<Secret, 'versions'>[] {
  const state = load();
  return state.secrets.map(({ versions, ...rest }) => rest);
}
export function revokeSecret(id: string){
  const state = load();
  const s = state.secrets.find(x => x.id === id);
  if(!s) throw new Error('not_found');
  s.revoked = true; s.revokedAt = new Date().toISOString();
  save(state);
}
export function grantAccess(secretId: string, _runId: string){
  const state = load();
  const s = state.secrets.find(x => x.id === secretId);
  if(!s || s.revoked) throw new Error('revoked_or_missing');
  const latest = s.versions[s.versions.length - 1];
  const value = decrypt(latest.enc);
  // In a real system, return a scoped handle; here we return the value for adapter mediation
  return { secretId: s.id, name: s.name, value, scopes: s.scopes };
}
