/**
 * Configuration Validation
 * Validates API keys and configuration before running
 */

import { config } from 'dotenv';

config();

export interface ValidationResult {
  valid: boolean;
  providers: {
    anthropic: { configured: boolean; valid: boolean; error?: string };
    openai: { configured: boolean; valid: boolean; error?: string };
    perplexity: { configured: boolean; valid: boolean; error?: string };
    gemini: { configured: boolean; valid: boolean; error?: string };
  };
  integrations: {
    email: { configured: boolean };
    slack: { configured: boolean };
    calendar: { configured: boolean };
  };
  warnings: string[];
  errors: string[];
}

/**
 * Validate Anthropic API key
 */
async function validateAnthropic(): Promise<{ valid: boolean; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_key_here' || key.length < 10) {
    return { valid: false, error: 'Not configured' };
  }
  
  // Basic format check
  if (!key.startsWith('sk-ant-')) {
    return { valid: false, error: 'Invalid key format (should start with sk-ant-)' };
  }
  
  return { valid: true };
}

/**
 * Validate OpenAI API key
 */
async function validateOpenAI(): Promise<{ valid: boolean; error?: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === 'your_key_here' || key.length < 10) {
    return { valid: false, error: 'Not configured' };
  }
  
  // Basic format check
  if (!key.startsWith('sk-')) {
    return { valid: false, error: 'Invalid key format (should start with sk-)' };
  }
  
  return { valid: true };
}

/**
 * Validate Perplexity API key
 */
async function validatePerplexity(): Promise<{ valid: boolean; error?: string }> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key || key === 'your_key_here' || key.length < 10) {
    return { valid: false, error: 'Not configured' };
  }
  
  // Basic format check
  if (!key.startsWith('pplx-')) {
    return { valid: false, error: 'Invalid key format (should start with pplx-)' };
  }
  
  return { valid: true };
}

/**
 * Validate Gemini API key
 */
async function validateGemini(): Promise<{ valid: boolean; error?: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_key_here' || key.length < 10) {
    return { valid: false, error: 'Not configured' };
  }
  
  // Basic format check
  if (!key.startsWith('AIza')) {
    return { valid: false, error: 'Invalid key format' };
  }
  
  return { valid: true };
}

/**
 * Check integration configuration
 */
function checkIntegrations() {
  return {
    email: {
      configured: !!(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASSWORD
      ),
    },
    slack: {
      configured: !!(
        process.env.SLACK_BOT_TOKEN &&
        process.env.SLACK_SIGNING_SECRET
      ),
    },
    calendar: {
      configured: !!(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET
      ),
    },
  };
}

/**
 * Full configuration validation
 */
export async function validateConfig(options: { 
  quick?: boolean;
  verbose?: boolean;
} = {}): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: false,
    providers: {
      anthropic: { configured: false, valid: false },
      openai: { configured: false, valid: false },
      perplexity: { configured: false, valid: false },
      gemini: { configured: false, valid: false },
    },
    integrations: checkIntegrations(),
    warnings: [],
    errors: [],
  };

  // Validate AI providers
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Check Anthropic
  result.providers.anthropic.configured = !!(anthropicKey && anthropicKey !== 'your_key_here');
  if (result.providers.anthropic.configured && !options.quick) {
    const validation = await validateAnthropic();
    result.providers.anthropic.valid = validation.valid;
    result.providers.anthropic.error = validation.error;
  } else if (result.providers.anthropic.configured) {
    result.providers.anthropic.valid = true; // Assume valid in quick mode
  }

  // Check OpenAI
  result.providers.openai.configured = !!(openaiKey && openaiKey !== 'your_key_here');
  if (result.providers.openai.configured && !options.quick) {
    const validation = await validateOpenAI();
    result.providers.openai.valid = validation.valid;
    result.providers.openai.error = validation.error;
  } else if (result.providers.openai.configured) {
    result.providers.openai.valid = true;
  }

  // Check Perplexity
  result.providers.perplexity.configured = !!(perplexityKey && perplexityKey !== 'your_key_here');
  if (result.providers.perplexity.configured) {
    const validation = await validatePerplexity();
    result.providers.perplexity.valid = validation.valid;
    result.providers.perplexity.error = validation.error;
  }

  // Check Gemini
  result.providers.gemini.configured = !!(geminiKey && geminiKey !== 'your_key_here');
  if (result.providers.gemini.configured) {
    const validation = await validateGemini();
    result.providers.gemini.valid = validation.valid;
    result.providers.gemini.error = validation.error;
  }

  // Determine overall validity
  const hasValidProvider = 
    result.providers.anthropic.valid ||
    result.providers.openai.valid ||
    result.providers.perplexity.valid ||
    result.providers.gemini.valid;

  if (!hasValidProvider) {
    result.errors.push('No valid AI provider configured. Please add at least one API key.');
  }

  // Warnings
  if (!result.providers.anthropic.valid && !result.providers.openai.valid) {
    result.warnings.push('Neither Anthropic nor OpenAI configured. Some features may be limited.');
  }

  if (!result.providers.perplexity.valid) {
    result.warnings.push('Perplexity not configured. Web search will use fallback.');
  }

  result.valid = hasValidProvider;

  return result;
}

/**
 * Print validation results
 */
export function printValidationResult(result: ValidationResult): void {
  const check = (ok: boolean) => ok ? '✅' : '❌';
  const warn = '⚠️';

  console.log('\n📋 Configuration Status\n');
  
  console.log('AI Providers:');
  console.log(`  ${check(result.providers.anthropic.valid)} Anthropic (Claude)${result.providers.anthropic.error ? ` - ${result.providers.anthropic.error}` : ''}`);
  console.log(`  ${check(result.providers.openai.valid)} OpenAI (GPT-4)${result.providers.openai.error ? ` - ${result.providers.openai.error}` : ''}`);
  console.log(`  ${check(result.providers.perplexity.valid)} Perplexity (Search)${result.providers.perplexity.error ? ` - ${result.providers.perplexity.error}` : ''}`);
  console.log(`  ${check(result.providers.gemini.valid)} Gemini${result.providers.gemini.error ? ` - ${result.providers.gemini.error}` : ''}`);

  console.log('\nIntegrations:');
  console.log(`  ${result.integrations.email.configured ? '✅' : '⬚'} Email (SMTP)`);
  console.log(`  ${result.integrations.slack.configured ? '✅' : '⬚'} Slack`);
  console.log(`  ${result.integrations.calendar.configured ? '✅' : '⬚'} Google Calendar`);

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach(w => console.log(`   ${w}`));
  }

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(e => console.log(`   ${e}`));
  }

  console.log(`\n${result.valid ? '✅ Configuration valid - ready to run!' : '❌ Configuration incomplete - run setup first'}\n`);
}

/**
 * Quick check if at least one provider is configured
 */
export function hasAnyProvider(): boolean {
  const keys = [
    process.env.ANTHROPIC_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.PERPLEXITY_API_KEY,
    process.env.GEMINI_API_KEY,
  ];
  
  return keys.some(k => k && k !== 'your_key_here' && k.length > 10);
}
