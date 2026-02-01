#!/usr/bin/env node
/**
 * Agentic Employee CLI
 * The command-line interface for your AI employee
 */

import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startDemoE2E } from './runner/index.js';
import { queryByRun, getAllRuns } from './audit/query.js';
import { addSecret, listSecrets, revokeSecret } from './vault/store.js';
import { runObjective, createAgentLoop } from './core/agent-loop.js';
import { generatePlan, createPlanner } from './planner/index.js';
import { getMemoryStore } from './memory/index.js';
import { getDomainManager, listDomains, getBrain } from './domains/index.js';
import type { RunContext } from './core/types.js';
import type { Message } from './ai/types.js';
import readline from 'readline';

async function main() {
  await yargs(hideBin(process.argv))
    // ============ RUN COMMAND ============
    .command(
      'run <objective>',
      'Run the agent with an objective',
      (y) => y
        .positional('objective', {
          type: 'string',
          description: 'The objective/task for the agent',
          demandOption: true,
        })
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          description: 'Show detailed execution logs',
        })
        .option('max-iterations', {
          type: 'number',
          default: 50,
          description: 'Maximum iterations',
        })
        .option('max-tools', {
          type: 'number',
          default: 100,
          description: 'Maximum tool calls',
        })
        .option('domain', {
          alias: 'd',
          type: 'string',
          description: 'Force specific domain (developer, marketing, sales, operations, general)',
        })
        .option('no-auto-domain', {
          type: 'boolean',
          description: 'Disable auto domain detection',
        }),
      async (argv) => {
        console.log('\n🤖 Agentic Employee starting...\n');
        console.log(`📋 Objective: ${argv.objective}\n`);

        const result = await runObjective(argv.objective!, {
          verbose: argv.verbose,
          maxIterations: argv['max-iterations'],
          maxToolCalls: argv['max-tools'],
          domain: argv.domain as any,
          autoDomain: !argv['no-auto-domain'],
        });

        console.log('\n' + '═'.repeat(60));
        console.log(`\n${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`📊 Iterations: ${result.iterations}`);
        console.log(`🔧 Tool calls: ${result.toolCalls}`);
        if (result.errors.length > 0) {
          console.log(`⚠️  Errors: ${result.errors.length}`);
          result.errors.forEach(e => console.log(`   - ${e}`));
        }
        console.log(`\n📝 Final Response:\n${result.finalResponse}\n`);
      }
    )

    // ============ CHAT COMMAND ============
    .command(
      'chat',
      'Interactive chat mode with the agent',
      (y) => y
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          description: 'Show tool executions',
        }),
      async (argv) => {
        console.log('\n🤖 Agentic Employee Chat Mode');
        console.log('Type your messages. Use /quit to exit, /clear to reset.\n');

        const agent = createAgentLoop({ verbose: argv.verbose });
        const messages: Message[] = [];
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const ctx: RunContext = {
          runId: `chat-${Date.now()}`,
          objective: { text: 'Interactive chat' },
          createdAt: Date.now(),
        };

        const prompt = () => {
          rl.question('You: ', async (input) => {
            const trimmed = input.trim();

            if (trimmed === '/quit' || trimmed === '/exit') {
              console.log('\nGoodbye! 👋\n');
              rl.close();
              return;
            }

            if (trimmed === '/clear') {
              messages.length = 0;
              console.log('Chat history cleared.\n');
              prompt();
              return;
            }

            if (!trimmed) {
              prompt();
              return;
            }

            messages.push({ role: 'user', content: trimmed });

            try {
              const response = await agent.chat(ctx, messages);
              messages.push(response.message);

              // Handle tool calls if any
              if (response.message.tool_calls?.length) {
                console.log('\n[Agent is using tools...]');
                for (const tc of response.message.tool_calls) {
                  if (argv.verbose) {
                    console.log(`  → ${tc.function.name}`);
                  }
                }
              }

              console.log(`\nAgent: ${response.message.content}\n`);
            } catch (error: any) {
              console.error(`\nError: ${error.message}\n`);
            }

            prompt();
          });
        };

        prompt();
      }
    )

    // ============ PLAN COMMAND ============
    .command(
      'plan <objective>',
      'Generate an execution plan without running it',
      (y) => y
        .positional('objective', {
          type: 'string',
          description: 'The objective to plan for',
          demandOption: true,
        })
        .option('output', {
          alias: 'o',
          type: 'string',
          description: 'Output file for the plan (JSON)',
        }),
      async (argv) => {
        console.log('\n📋 Generating plan...\n');

        const plan = await generatePlan(argv.objective!);

        console.log('Objective:', plan.objective);
        console.log('Steps:', plan.steps.length);
        console.log('Estimated:', plan.estimatedDuration || 'Unknown');
        console.log('\nSteps:');
        plan.steps.forEach((s, i) => {
          console.log(`  ${i + 1}. [${s.type}] ${s.description || JSON.stringify(s.params).slice(0, 60)}`);
        });

        if (plan.risks?.length) {
          console.log('\nRisks:');
          plan.risks.forEach(r => console.log(`  ⚠️  ${r}`));
        }

        if (argv.output) {
          const fs = await import('fs/promises');
          await fs.writeFile(argv.output, JSON.stringify(plan, null, 2));
          console.log(`\nPlan saved to ${argv.output}`);
        }
      }
    )

    // ============ RUNNER COMMANDS ============
    .command(
      'runner start demo-e2e',
      'Run the demo objective end-to-end (legacy)',
      {},
      async () => {
        await startDemoE2E();
      }
    )

    // ============ AUDIT COMMANDS ============
    .command(
      'audit',
      'Query audit events',
      (y) => y
        .option('runId', { type: 'string', description: 'Filter by run ID' })
        .option('list', { type: 'boolean', description: 'List all runs' }),
      async (argv) => {
        if (argv.list) {
          const runs = getAllRuns();
          console.log(JSON.stringify(runs, null, 2));
        } else if (argv.runId) {
          const rows = queryByRun(String(argv.runId));
          console.log(JSON.stringify(rows, null, 2));
        } else {
          const runs = getAllRuns();
          console.log(JSON.stringify(runs, null, 2));
        }
      }
    )

    // ============ VAULT COMMANDS ============
    .command(
      'vault add',
      'Add secret to vault',
      (y) => y
        .option('name', { type: 'string', demandOption: true })
        .option('value', { type: 'string', demandOption: true })
        .option('scopes', { type: 'string', demandOption: true }),
      async (argv) => {
        const scopes = String(argv.scopes).split(',').map(s => s.trim()).filter(Boolean);
        const s = addSecret(String(argv.name), String(argv.value), scopes);
        console.log(JSON.stringify({ id: s.id, name: s.name, scopes: s.scopes }, null, 2));
      }
    )
    .command('vault list', 'List secrets (redacted)', {}, async () => {
      console.log(JSON.stringify(listSecrets(), null, 2));
    })
    .command(
      'vault revoke',
      'Revoke secret',
      (y) => y.option('id', { type: 'string', demandOption: true }),
      async (argv) => {
        revokeSecret(String(argv.id));
        console.log(JSON.stringify({ revoked: true, id: argv.id }, null, 2));
      }
    )

    // ============ MEMORY COMMANDS ============
    .command(
      'memory list',
      'List all memory keys',
      {},
      async () => {
        const store = getMemoryStore();
        const keys = await store.list();
        console.log(JSON.stringify({ keys, count: keys.length }, null, 2));
      }
    )
    .command(
      'memory get <key>',
      'Get a memory entry',
      (y) => y.positional('key', { type: 'string', demandOption: true }),
      async (argv) => {
        const store = getMemoryStore();
        const entry = await store.retrieve(argv.key!);
        console.log(JSON.stringify(entry, null, 2));
      }
    )
    .command(
      'memory set <key> <value>',
      'Store a memory entry',
      (y) => y
        .positional('key', { type: 'string', demandOption: true })
        .positional('value', { type: 'string', demandOption: true })
        .option('tags', { type: 'string', description: 'Comma-separated tags' }),
      async (argv) => {
        const store = getMemoryStore();
        const tags = argv.tags?.split(',').map(t => t.trim()).filter(Boolean);
        await store.store(argv.key!, argv.value!, tags);
        console.log(JSON.stringify({ stored: argv.key }, null, 2));
      }
    )
    .command(
      'memory search <query>',
      'Search memory',
      (y) => y.positional('query', { type: 'string', demandOption: true }),
      async (argv) => {
        const store = getMemoryStore();
        const results = await store.search(argv.query!);
        console.log(JSON.stringify(results, null, 2));
      }
    )
    .command(
      'memory stats',
      'Show memory statistics',
      {},
      async () => {
        const store = getMemoryStore();
        const stats = await store.stats();
        console.log(JSON.stringify(stats, null, 2));
      }
    )

    // ============ STATUS COMMAND ============
    .command(
      'status',
      'Show system status',
      {},
      async () => {
        const { createRouterFromEnv } = await import('./ai/router.js');
        const router = createRouterFromEnv();
        const providers = router.getAvailableProviders();

        console.log('\n🤖 Agentic Employee Status\n');
        console.log('Available AI Providers:');
        providers.forEach(p => console.log(`  ✅ ${p}`));
        
        if (providers.length === 0) {
          console.log('  ⚠️  No providers configured');
          console.log('\n  Set API keys in environment:');
          console.log('    OPENAI_API_KEY');
          console.log('    ANTHROPIC_API_KEY');
          console.log('    PERPLEXITY_API_KEY');
        }

        const store = getMemoryStore();
        const stats = await store.stats();
        console.log(`\nMemory: ${stats.entryCount} entries, ${stats.conversationCount} conversations`);
        console.log('');
      }
    )

    // ============ DOMAINS COMMAND ============
    .command(
      'domains',
      'List available domain brains',
      (y) => y
        .option('show', {
          alias: 's',
          type: 'string',
          description: 'Show details for specific domain',
        }),
      async (argv) => {
        if (argv.show) {
          const brain = getBrain(argv.show as any);
          console.log(`\n🧠 Domain: ${brain.name}\n`);
          console.log(`ID: ${brain.id}`);
          console.log(`Description: ${brain.description}`);
          console.log(`Autonomy Level: ${(brain.autonomyLevel || 0.7) * 100}%`);
          console.log(`Preferred Model: ${brain.preferredModel || 'default'}`);
          
          if (brain.triggerKeywords && brain.triggerKeywords.length > 0) {
            console.log(`\nTrigger Keywords: ${brain.triggerKeywords.slice(0, 10).join(', ')}...`);
          }
          
          if (brain.rules && brain.rules.length > 0) {
            console.log(`\nRules (${brain.rules.length}):`);
            brain.rules.forEach(r => {
              const icon = r.type === 'must' ? '✅' : r.type === 'must_not' ? '❌' : '⚠️';
              console.log(`  ${icon} ${r.description}`);
            });
          }
          
          if (brain.preferredTools && brain.preferredTools.length > 0) {
            console.log(`\nPreferred Tools: ${brain.preferredTools.join(', ')}`);
          }
          
          if (brain.restrictedTools && brain.restrictedTools.length > 0) {
            console.log(`Restricted Tools: ${brain.restrictedTools.join(', ')}`);
          }
          
          console.log('');
        } else {
          console.log('\n🧠 Available Domain Brains\n');
          const domains = listDomains();
          domains.forEach(d => {
            console.log(`  ${d.id.padEnd(12)} - ${d.name}`);
            console.log(`  ${''.padEnd(12)}   ${d.description}\n`);
          });
          console.log('Use --show <domain> to see details for a specific domain.');
          console.log('Use --domain <domain> with "run" to force a specific domain.\n');
        }
      }
    )

    .demandCommand(1)
    .help()
    .version('0.2.0')
    .parse();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
