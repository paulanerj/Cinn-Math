// ============================================================
// MODULE: EngineContractValidator
// PURPOSE: Runtime type-checking for procedural math generation.
// CONTRACT:
//   - INPUTS: Step objects and generated answer arrays.
//   - SIDE EFFECTS: Throws fatal errors during DEV_MODE.
// WHY THIS EXISTS: Fails fast if a traversal plugin violates schema.
// ============================================================
import { DEV_MODE } from './constants.js';

export const EngineContractValidator = {
  validateStep(step) {
    if (!DEV_MODE) return;
    if (typeof step.startNumber !== 'number') throw new Error('EngineContractViolation: invalid startNumber');
    if (typeof step.correctAnswer !== 'number') throw new Error('EngineContractViolation: invalid correctAnswer');
    if (!step.operation) throw new Error('EngineContractViolation: missing operation');
  },
  validateGeneratedStep(step, answers) {
    if (!DEV_MODE) return;
    if (!answers.includes(step.correctAnswer)) throw new Error('EngineContractViolation: correct answer missing');
    const duplicates = answers.filter(a => a === step.correctAnswer);
    if (duplicates.length > 1) throw new Error('EngineContractViolation: multiple correct answers');
  },
  validateTraversal(result) {
    if (!DEV_MODE) return;
    if (!Number.isInteger(result.nextValue)) throw new Error('EngineContractViolation: traversal produced non integer');
    if (result.nextValue === result.startNumber) throw new Error('EngineContractViolation: traversal produced no change');
  }
};
