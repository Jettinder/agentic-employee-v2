export const SANDBOX = {
  allowedRoot: 'demo_v2',
  allowedTerminal: [/^\.\/demo_v2\/main\.sh(\s.*)?$/],
};
export function ensureUnderAllowed(path: string){
  const norm = path.replace(/\\/g,'/');
  if(!norm.startsWith(`${SANDBOX.allowedRoot}`)){
    throw Object.assign(new Error(`Path not allowed: ${path}`), { code: 'SANDBOX_PATH_DENY' });
  }
}
