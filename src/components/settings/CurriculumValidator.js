// ============================================================
// MODULE: CurriculumValidator
// PURPOSE: Pure validation of curriculum block arrays.
// CONTRACT: No side-effects. Returns { valid, errors }.
// ============================================================

export const CurriculumValidator = {
  validate(curriculum) {
    const errors = [];
    if (!curriculum || curriculum.length === 0) return { valid: false, errors: ['Curriculum cannot be empty.'] };

    const sorted = [...curriculum].sort((a, b) => a.start - b.start);
    if (sorted[0].start !== 1) errors.push('Curriculum must start at step 1.');

    for (let i = 0; i < sorted.length; i++) {
      const block = sorted[i];
      if (block.start >= block.end) errors.push(`Block ${i + 1}: Start (${block.start}) must be strictly less than End (${block.end}).`);
      if (block.modifiers < 1 || block.modifiers > 3) errors.push(`Block ${i + 1}: Modifiers must be between 1 and 3.`);
      if (block.timer < 3) errors.push(`Block ${i + 1}: Timer must be at least 3 seconds.`);
      if (block.rangeMax < 2) errors.push(`Block ${i + 1}: RangeMax must be at least 2.`);
      if (block.distractors < 1 || block.distractors > 3) errors.push(`Block ${i + 1}: Distractors must be between 1 and 3.`);
      if (!/^[+\-×÷]+$/.test(block.operations)) errors.push(`Block ${i + 1}: Operations must only contain +, -, ×, ÷.`);
      if (i > 0) {
        const prev = sorted[i - 1];
        if (block.start < prev.end + 1) errors.push(`Overlap: Block starting at ${block.start} overlaps with previous block ending at ${prev.end}.`);
        else if (block.start > prev.end + 1) errors.push(`Gap: Missing steps between ${prev.end} and ${block.start}.`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
};
