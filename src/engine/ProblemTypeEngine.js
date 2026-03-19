// ============================================================
// MODULE: ProblemTypeEngine
// PURPOSE: Routes raw procedural math steps into standardized UI schemas.
// CONTRACT:
//   - INPUTS: raw step object, current centerValue, global config.
//   - OUTPUTS: { type, centerValue, context, promptTitle, answers, correctAnswer, modifiers }
// INVARIANTS / LOCKED RULES:
//   - The centerValue MUST NEVER appear inside the context string.
//   - If type !== "standard", modifiers array MUST be empty.
// WHY THIS EXISTS: Allows the UI to support advanced math formats (equations, sequences)
//   without rewriting the core Traversal/Reducer engines.
// ============================================================

export const ProblemTypeEngine = {
  createProblem(step, centerValue, config) {
    if (!step) return null;
    const mode = config.learningMode;
    let problem = {
      type: 'standard',
      centerValue: centerValue,
      context: null,
      promptTitle: null,
      correctAnswer: step.correctAnswer,
      modifiers: step.modifiers || []
    };

    if (mode === 'multiplication' && step.operation === '×') {
      problem.modifiers = [{ operation: `×${step.value}`, value: '', position: 'bottom' }];
    } else if (mode === 'skipcount') {
      problem.modifiers = [{ operation: `${step.operation}${step.value}`, value: '', position: 'bottom' }];
    } else if (mode === 'pattern' && step.operation === 'pattern') {
      problem.type = 'sequence';
      problem.promptTitle = 'CONTINUE THE PATTERN';

      let seq = step.meta?.sequence || [];
      // Enforce invariant: remove centerValue from context if present
      let displaySeq = seq.filter(v => v !== centerValue);
      displaySeq.push('?');
      problem.context = `[ ${displaySeq.join(', ')} ]`;
      problem.modifiers = []; // Enforce: no modifiers for context types
    }

    return problem;
  }
};
