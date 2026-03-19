// ============================================================
// MODULE: MathTraversalEngine
// PURPOSE: Routes to the correct traversal plugin based on learningMode.
// CONTRACT: Result must pass EngineContractValidator.validateTraversal().
// ============================================================
import { skipCountTraversal } from './skipCount.js';
import { multiplicationTraversal } from './multiplication.js';
import { patternTraversal } from './pattern.js';
import { EngineContractValidator } from '../EngineContractValidator.js';

export const MathTraversalEngine = {
  getNextValue(state, config) {
    const plugins = {
      skipcount: skipCountTraversal,
      multiplication: multiplicationTraversal,
      pattern: patternTraversal
    };
    const plugin = plugins[config.learningMode];
    let result;

    if (plugin) {
      result = plugin(state, config);
    } else {
      result = { nextValue: state.currentValue, operation: '+', value: 0, traversalState: state.traversalState, meta: {} };
    }

    EngineContractValidator.validateTraversal(result);
    return result;
  }
};
