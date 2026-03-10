// [ROLE] Single source of truth for the GridMath engine version.
// Increment this when the engine's public contract changes in a way that
// would make saved sessions or replay files incompatible.
//
// [INVARIANT] Must be a semver string. Replay files embed this value; a
// mismatch between the stored version and ENGINE_VERSION signals that
// the replay may not play back correctly.
//
// [LLM NOTE] Do not change this value during routine reconstruction.
// Only bump it when a Phase explicitly calls for a compatibility break.

export const ENGINE_VERSION = '2.0.0';
