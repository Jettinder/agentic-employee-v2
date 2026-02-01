/**
 * Domain Brains Index
 * Export all available domain brains
 */

export { generalBrain } from './general.js';
export { developerBrain } from './developer.js';
export { marketingBrain } from './marketing.js';
export { salesBrain } from './sales.js';
export { operationsBrain } from './operations.js';
export { financeBrain } from './finance.js';
export { hrBrain } from './hr.js';
export { supportBrain } from './support.js';

import { generalBrain } from './general.js';
import { developerBrain } from './developer.js';
import { marketingBrain } from './marketing.js';
import { salesBrain } from './sales.js';
import { operationsBrain } from './operations.js';
import { financeBrain } from './finance.js';
import { hrBrain } from './hr.js';
import { supportBrain } from './support.js';
import type { DomainBrain, DomainId } from '../types.js';

/**
 * All available domain brains
 */
export const ALL_BRAINS: Record<DomainId, DomainBrain> = {
  general: generalBrain,
  developer: developerBrain,
  marketing: marketingBrain,
  sales: salesBrain,
  operations: operationsBrain,
  finance: financeBrain,
  hr: hrBrain,
  support: supportBrain,
};

/**
 * Get a brain by ID
 */
export function getBrain(id: DomainId): DomainBrain {
  return ALL_BRAINS[id] || generalBrain;
}

/**
 * List all available domains
 */
export function listDomains(): Array<{ id: DomainId; name: string; description: string }> {
  return Object.values(ALL_BRAINS).map(brain => ({
    id: brain.id,
    name: brain.name,
    description: brain.description,
  }));
}
