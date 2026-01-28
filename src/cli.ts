import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startDemoE2E } from './runner/index.js';

async function main() {
  await yargs(hideBin(process.argv))
    .command('runner start demo-e2e', 'Run the demo objective end-to-end', {}, async () => {
      await startDemoE2E();
    })
    .demandCommand(1)
    .help()
    .parse();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
