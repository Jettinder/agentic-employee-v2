function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }
export async function withRetry<T>(fn:()=>Promise<T>, cfg:{attempts:number, baseMs?:number, factor?:number, jitterPct?:number}){
  const base=cfg.baseMs??200, factor=cfg.factor??2, jitterPct=cfg.jitterPct??0.2;
  let attempt=0; let lastErr:any;
  while(attempt<cfg.attempts){
    try{ return await fn(); }catch(e){ lastErr=e; attempt++; if(attempt>=cfg.attempts) break; const backoff=base*Math.pow(factor,attempt-1); const jitter=backoff*(Math.random()*jitterPct); await sleep(backoff+jitter); }
  }
  throw lastErr;
}
