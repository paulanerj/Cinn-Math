// ============================================================
// MODULE: TestSuite
// PURPOSE: Exposed globally for developer verification of constraints.
// EXPOSED GLOBALS: window.testPatternSteps, window.testMultiplicationTraversal,
//   window.verifyCenterAlignment, window.testDistractors
// ============================================================
import { DEV_MODE } from '../engine/constants.js';
import { DEFAULT_CONFIG as CONFIG } from '../engine/config.js';
import { ProblemGenerator } from '../engine/ProblemGenerator.js';
import { ProblemTypeEngine } from '../engine/ProblemTypeEngine.js';

if (DEV_MODE) {
  window.testPatternSteps = (n = 10) => {
    const config = { ...CONFIG, learningMode: 'pattern', totalSteps: n };
    const steps = ProblemGenerator.generateSequence(10, config);
    if (!steps) { console.error('Pattern sequence failed to generate.'); return; }
    steps.forEach((step, i) => {
      const problem = ProblemTypeEngine.createProblem(step, step.startNumber, config);
      const answers = ProblemGenerator.generateDistractors(step.correctAnswer, step, config);
      console.log(`Pattern Step ${i + 1}`);
      console.log(`center: ${problem.centerValue}`);
      console.log(`sequence: [${(step.meta.sequence || []).join(',')}]`);
      console.log(`step: ${step.meta.isReverse ? '-' : '+'}${step.value}`);
      console.log(`correct: ${step.correctAnswer}`);
      console.log(`answers: [${answers.join(',')}]\n`);
    });
    console.log('Pattern Display Correctness Test Complete.');
  };

  window.testMultiplicationTraversal = (base = 7, stepsCount = 20) => {
    const config = { ...CONFIG, learningMode: 'multiplication', multBase: base, totalSteps: stepsCount };
    const steps = ProblemGenerator.generateSequence(base, config);
    if (!steps) { console.error('Multiplication sequence failed to generate.'); return; }
    steps.forEach(step => console.log(`${base}×${step.startNumber} = ${step.correctAnswer}`));
    console.log('Multiplication Traversal Correctness Test Complete.');
  };

  window.verifyCenterAlignment = (stepsCount = 50) => {
    const config = { ...CONFIG, learningMode: 'standard', totalSteps: stepsCount };
    const steps = ProblemGenerator.generateSequence(10, config);
    let allPass = true;
    if (!steps) { console.error('Sequence failed to generate.'); return; }
    steps.forEach((step, i) => {
      let currentCenter = i === 0
        ? (step.startNumber !== undefined ? step.startNumber : 10)
        : steps[i - 1].correctAnswer;
      if (currentCenter !== step.startNumber) {
        console.error(`CENTER MISALIGNMENT at Step ${i + 1}. Expected: ${currentCenter}, Got: ${step.startNumber}`);
        allPass = false;
      } else {
        console.log(`STEP ${i + 1} PASS\ncenter = ${currentCenter}\nstartNumber = ${step.startNumber}\n`);
      }
    });
    if (allPass) console.log('ALL ALIGNMENT TESTS PASSED.');
  };

  window.testDistractors = (stepsCount = 20) => {
    const config = { ...CONFIG, totalSteps: stepsCount };
    const steps = ProblemGenerator.generateSequence(10, config);
    let collisions = 0;
    if (!steps) { console.error('Sequence failed to generate.'); return; }
    steps.forEach((step, i) => {
      const answers = ProblemGenerator.generateDistractors(step.correctAnswer, step, config);
      const unique = new Set(answers);
      console.log(`Correct: ${step.correctAnswer}`);
      console.log(`Distractors: ${answers.filter(a => a !== step.correctAnswer).join(',')}`);
      if (unique.size !== answers.length || answers.filter(a => a === step.correctAnswer).length > 1) {
        console.error('DISTRACTOR COLLISION DETECTED'); collisions++;
      } else { console.log('VALID\n'); }
    });
    if (collisions === 0) console.log('ALL DISTRACTOR TESTS PASSED.');
  };
}
