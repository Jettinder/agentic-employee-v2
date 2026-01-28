import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startDemoE2E } from './runner/index.js';
import { queryByRun } from './audit/query.js';
import { addSecret, listSecrets, revokeSecret } from './vault/store.js';

async function main() {
  await yargs(hideBin(process.argv))
    .command('runner start demo-e2e', 'Run the demo objective end-to-end', {}, async () => { await startDemoE2E(); })
    .command('audit', 'Query audit events', (y)=> y.option('runId', { type:'string', demandOption: true }), async (argv)=>{
      const rows = queryByRun(String(argv.runId));
      console.log(JSON.stringify(rows, null, 2));
    })
    .command('vault add', 'Add secret to vault', (y)=> y.option('name',{type:'string', demandOption:true}).option('value',{type:'string', demandOption:true}).option('scopes',{type:'string', demandOption:true}), async (argv)=>{
      const scopes = String(argv.scopes).split(',').map(s=>s.trim()).filter(Boolean);
      const s = addSecret(String(argv.name), String(argv.value), scopes);
      console.log(JSON.stringify({ id: s.id, name: s.name, scopes: s.scopes }, null, 2));
    })
    .command('vault list', 'List secrets (redacted)', {}, async ()=>{
      console.log(JSON.stringify(listSecrets(), null, 2));
    })
    .command('vault revoke', 'Revoke secret', (y)=> y.option('id',{type:'string', demandOption:true}), async (argv)=>{
      revokeSecret(String(argv.id));
      console.log(JSON.stringify({ revoked: true, id: argv.id }, null, 2));
    })
    .demandCommand(1)
    .help()
    .parse();
}

main().catch(err => { console.error(err); process.exit(1); });
