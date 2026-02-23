
export const INVARIANTS = {
  ENGINE_STABILITY: [
    "GridEngine mutations must be deterministic.",
    "Adjacency rules (Moore neighborhood) must be strictly enforced during input conclusion.",
    "Trophy precedence (Swap > Combine) is absolute."
  ],
  GRAVITY_ISOLATION: [
    "Spawns must be visually delayed per-column to prevent 'overtaking' existing falling tiles.",
    "The board remains 'Busy-Locked' until all gravity bodies have settled."
  ],
  INTERACTION_FIDELITY: [
    "Pointer capture on container is mandatory.",
    "10px distance threshold before classifying a gesture as 'Drag'.",
    "Authoritative DOM metrics must be used for all coordinate mapping.",
    "Stone permanence: STONE is created ONLY by exceeding the target value (res > targetValue).",
    "Bomb Lockdown: Bombs are exempt from math/combine rules and only move via Trophy swaps."
  ]
};
