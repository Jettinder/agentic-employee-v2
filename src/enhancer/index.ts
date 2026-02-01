/**
 * Prompt Enhancer
 * Automatically improves user prompts by adding implicit requirements,
 * best practices, and useful details that users typically forget to mention.
 */

import { createRouterFromEnv } from '../ai/router.js';
import type { RunContext } from '../core/types.js';

export interface EnhancementResult {
  original: string;
  enhanced: string;
  additions: string[];
  domain: string;
  confidence: number;
}

// Domain-specific enhancements
const DOMAIN_ENHANCEMENTS: Record<string, string[]> = {
  developer: [
    'Include proper error handling and edge cases',
    'Add comments explaining complex logic',
    'Follow best practices and coding standards',
    'Make the code maintainable and readable',
    'Consider security implications',
    'Add input validation where appropriate',
  ],
  marketing: [
    'Use engaging and persuasive language',
    'Include a clear call-to-action',
    'Optimize for the target audience',
    'Follow brand voice guidelines if provided',
    'Make it shareable and memorable',
    'Include relevant hashtags for social media',
  ],
  sales: [
    'Focus on benefits, not just features',
    'Address potential objections proactively',
    'Include social proof or credibility elements',
    'Create urgency without being pushy',
    'Personalize the message where possible',
    'Include clear next steps',
  ],
  operations: [
    'Document the process for repeatability',
    'Include error handling and recovery steps',
    'Consider scalability and performance',
    'Add logging for monitoring',
    'Make it idempotent where possible',
    'Include rollback procedures',
  ],
  finance: [
    'Ensure accuracy and precision',
    'Include all relevant calculations',
    'Add audit trail where needed',
    'Follow compliance requirements',
    'Double-check all numbers',
    'Include clear explanations',
  ],
  hr: [
    'Be inclusive and unbiased',
    'Follow legal requirements',
    'Maintain confidentiality',
    'Be clear and professional',
    'Consider employee experience',
    'Document everything properly',
  ],
  support: [
    'Be empathetic and helpful',
    'Provide clear step-by-step instructions',
    'Include troubleshooting alternatives',
    'Set clear expectations',
    'Follow up on resolution',
    'Document for knowledge base',
  ],
  general: [
    'Be thorough and complete',
    'Consider edge cases',
    'Make it user-friendly',
    'Include examples where helpful',
    'Verify the output before completing',
  ],
};

// Task-specific keywords and their enhancements
const TASK_PATTERNS: Array<{
  keywords: string[];
  enhancements: string[];
}> = [
  {
    keywords: ['create', 'write', 'make', 'build'],
    enhancements: [
      'Create a complete, working solution',
      'Test the output before reporting completion',
    ],
  },
  {
    keywords: ['file', 'save', 'store'],
    enhancements: [
      'Use an appropriate file location',
      'Handle the case where the file already exists',
    ],
  },
  {
    keywords: ['script', 'program', 'code'],
    enhancements: [
      'Make the code executable and self-contained',
      'Include a shebang line if appropriate',
      'Add usage instructions or help text',
    ],
  },
  {
    keywords: ['email', 'message', 'notification'],
    enhancements: [
      'Use a professional but appropriate tone',
      'Include all necessary information',
      'Proofread for errors',
    ],
  },
  {
    keywords: ['analyze', 'review', 'check'],
    enhancements: [
      'Provide actionable insights',
      'Highlight key findings',
      'Suggest improvements',
    ],
  },
  {
    keywords: ['search', 'find', 'lookup'],
    enhancements: [
      'Use multiple sources if available',
      'Verify information accuracy',
      'Provide context for results',
    ],
  },
  {
    keywords: ['automate', 'schedule', 'recurring'],
    enhancements: [
      'Include error handling for failures',
      'Add logging for monitoring',
      'Consider edge cases and timing issues',
    ],
  },
];

/**
 * Detect the domain from the prompt
 */
function detectDomain(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  const domainKeywords: Record<string, string[]> = {
    developer: ['code', 'script', 'function', 'bug', 'api', 'database', 'deploy', 'git', 'npm', 'python', 'javascript', 'typescript'],
    marketing: ['marketing', 'campaign', 'content', 'social', 'seo', 'brand', 'linkedin', 'twitter', 'post', 'blog'],
    sales: ['sales', 'lead', 'customer', 'deal', 'proposal', 'pitch', 'crm', 'prospect', 'outreach'],
    operations: ['automate', 'process', 'workflow', 'report', 'data', 'pipeline', 'integration', 'monitoring'],
    finance: ['invoice', 'budget', 'expense', 'payment', 'financial', 'accounting', 'tax', 'revenue'],
    hr: ['hiring', 'recruit', 'employee', 'onboarding', 'policy', 'performance', 'training'],
    support: ['ticket', 'support', 'help', 'issue', 'problem', 'customer service', 'troubleshoot'],
  };
  
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const matches = keywords.filter(k => lowerPrompt.includes(k));
    if (matches.length >= 2) return domain;
    if (matches.length === 1 && lowerPrompt.split(' ').length < 10) return domain;
  }
  
  return 'general';
}

/**
 * Get applicable task enhancements
 */
function getTaskEnhancements(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const enhancements: string[] = [];
  
  for (const pattern of TASK_PATTERNS) {
    const hasMatch = pattern.keywords.some(k => lowerPrompt.includes(k));
    if (hasMatch) {
      enhancements.push(...pattern.enhancements);
    }
  }
  
  return [...new Set(enhancements)]; // Remove duplicates
}

/**
 * Enhance a user prompt with implicit requirements
 */
export async function enhancePrompt(
  prompt: string,
  options: {
    domain?: string;
    useAI?: boolean;
    context?: RunContext;
  } = {}
): Promise<EnhancementResult> {
  const domain = options.domain || detectDomain(prompt);
  const domainEnhancements = DOMAIN_ENHANCEMENTS[domain] || DOMAIN_ENHANCEMENTS.general;
  const taskEnhancements = getTaskEnhancements(prompt);
  
  // Combine and deduplicate enhancements
  const allEnhancements = [...new Set([...taskEnhancements, ...domainEnhancements.slice(0, 3)])];
  
  // Build enhanced prompt
  const enhancementText = allEnhancements.length > 0
    ? `\n\nImplicit requirements (handle automatically):\n${allEnhancements.map(e => `- ${e}`).join('\n')}`
    : '';
  
  const enhanced = `${prompt}${enhancementText}`;
  
  return {
    original: prompt,
    enhanced,
    additions: allEnhancements,
    domain,
    confidence: allEnhancements.length > 2 ? 0.9 : 0.7,
  };
}

/**
 * AI-powered prompt enhancement for complex tasks
 */
export async function enhancePromptWithAI(
  prompt: string,
  ctx?: RunContext
): Promise<EnhancementResult> {
  const router = createRouterFromEnv();
  
  const systemPrompt = `You are a prompt enhancement specialist. Your job is to improve user prompts by:
1. Identifying implicit requirements that users typically forget
2. Adding best practices and quality standards
3. Clarifying ambiguities
4. Adding helpful constraints

Return ONLY a JSON object with:
{
  "enhanced": "the improved prompt",
  "additions": ["list of things you added"],
  "domain": "detected domain",
  "reasoning": "brief explanation"
}

Keep the original intent intact. Add 3-5 implicit requirements that make sense for the task.`;

  try {
    const response = await router.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Enhance this prompt:\n\n"${prompt}"` },
      ],
      temperature: 0.3,
    }, ctx || { runId: 'enhance', objective: { text: prompt }, createdAt: Date.now() });
    
    // Parse JSON response
    const content = response.message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        original: prompt,
        enhanced: result.enhanced || prompt,
        additions: result.additions || [],
        domain: result.domain || 'general',
        confidence: 0.95,
      };
    }
  } catch (error) {
    console.warn('[Enhancer] AI enhancement failed, using rule-based:', error);
  }
  
  // Fallback to rule-based enhancement
  return enhancePrompt(prompt);
}

/**
 * Quick enhancement without AI (fast, rule-based)
 */
export function quickEnhance(prompt: string, domain?: string): string {
  const result = enhancePromptSync(prompt, domain);
  return result.enhanced;
}

/**
 * Synchronous version for quick use
 */
function enhancePromptSync(prompt: string, forceDomain?: string): EnhancementResult {
  const domain = forceDomain || detectDomain(prompt);
  const domainEnhancements = DOMAIN_ENHANCEMENTS[domain] || DOMAIN_ENHANCEMENTS.general;
  const taskEnhancements = getTaskEnhancements(prompt);
  
  const allEnhancements = [...new Set([...taskEnhancements, ...domainEnhancements.slice(0, 3)])];
  
  const enhancementText = allEnhancements.length > 0
    ? `\n\nImplicit requirements:\n${allEnhancements.map(e => `- ${e}`).join('\n')}`
    : '';
  
  return {
    original: prompt,
    enhanced: `${prompt}${enhancementText}`,
    additions: allEnhancements,
    domain,
    confidence: 0.8,
  };
}

export default {
  enhancePrompt,
  enhancePromptWithAI,
  quickEnhance,
  detectDomain,
};
