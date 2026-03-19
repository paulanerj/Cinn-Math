// ============================================================
// MODULE: Curriculum Definition
// PURPOSE: Defines standard difficulty progression bands.
// INVARIANT: window.CURRICULUM_BLOCKS must remain a writable global
//   because CurriculumEditor saves updated blocks back to it.
// ============================================================

export const DEFAULT_CURRICULUM_BLOCKS = [
  { start: 1,  end: 5,  rangeMax: 5,  modifiers: 1, operations: '+-',   timer: 10, distractors: 1, variables: false },
  { start: 6,  end: 10, rangeMax: 7,  modifiers: 1, operations: '+-',   timer: 10, distractors: 2, variables: false },
  { start: 11, end: 15, rangeMax: 8,  modifiers: 2, operations: '+-',   timer: 8,  distractors: 2, variables: false },
  { start: 16, end: 20, rangeMax: 10, modifiers: 2, operations: '+-',   timer: 5,  distractors: 3, variables: false },
  { start: 21, end: 25, rangeMax: 10, modifiers: 2, operations: '+-×',  timer: 8,  distractors: 2, variables: false },
  { start: 26, end: 30, rangeMax: 5,  modifiers: 2, operations: '+-',   timer: 10, distractors: 2, variables: false },
  { start: 31, end: 35, rangeMax: 8,  modifiers: 2, operations: '+-',   timer: 8,  distractors: 2, variables: false },
  { start: 36, end: 40, rangeMax: 10, modifiers: 2, operations: '+-×',  timer: 8,  distractors: 2, variables: false },
  { start: 41, end: 45, rangeMax: 12, modifiers: 2, operations: '+-×',  timer: 7,  distractors: 3, variables: false },
  { start: 46, end: 50, rangeMax: 10, modifiers: 3, operations: '+-',   timer: 10, distractors: 3, variables: true  },
];

// Load from localStorage override if present, else use defaults.
// INVARIANT: window.CURRICULUM_BLOCKS is the live reference used throughout the engine.
try {
  const saved = localStorage.getItem('speedmath_curriculum');
  window.CURRICULUM_BLOCKS = saved ? JSON.parse(saved) : DEFAULT_CURRICULUM_BLOCKS;
} catch(e) {
  window.CURRICULUM_BLOCKS = DEFAULT_CURRICULUM_BLOCKS;
}

export const getCurriculumForStep = (stepNumber) => {
  for (const block of window.CURRICULUM_BLOCKS) {
    if (stepNumber >= block.start && stepNumber <= block.end) return block;
  }
  return window.CURRICULUM_BLOCKS[window.CURRICULUM_BLOCKS.length - 1];
};
