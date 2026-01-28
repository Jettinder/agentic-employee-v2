export type ResultCode = 'OK'|'DENIED'|'VALIDATION_FAIL'|'EXEC_ERROR';
export interface ResultEnvelope<T=any>{ ok: boolean; code: ResultCode; timingMs: number; stdout?: string; stderr?: string; exitCode?: number; data?: T; error?: { code?: string; message: string } }
export function ok<T>(timingMs:number, data?:T): ResultEnvelope<T> { return { ok:true, code:'OK', timingMs, data }; }
export function err(code:ResultCode, timingMs:number, e:any): ResultEnvelope { return { ok:false, code, timingMs, error:{ code: (e?.code||undefined), message: String(e?.message||e) } } }
