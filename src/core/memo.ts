import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
const PATH='.data/memo.json';
export function memoGet(key:string){ try{ const txt = readFileSync(PATH,'utf8'); const j=JSON.parse(txt); return j[key]; }catch{ return undefined; } }
export function memoSet(key:string,value:any){ try{ if(!existsSync('.data')) mkdirSync('.data'); let j:any={}; try{ j=JSON.parse(readFileSync(PATH,'utf8')); }catch{} j[key]=value; writeFileSync(PATH, JSON.stringify(j,null,2)); }catch{}
}
