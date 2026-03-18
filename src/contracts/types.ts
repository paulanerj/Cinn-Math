export type VersionTag = string;

export type LearningMode =
  | "standard"
  | "multiplication"
  | "skipcount"
  | "pattern"
  | "unknown";

export type PhaseMode =
  | "normal"
  | "qmm"
  | "dark"
  | "unknown";

export type SkillRef =
  | ResolvedSkillRef
  | PartialSkillRef
  | FallbackSkillRef;

export interface ResolvedSkillRef {
  tier: "resolved";
  domain: "arithmetic";
  operation: "add" | "sub" | "mul" | "div";
  structure: "fact";
  operands: number[];
}

export interface PartialSkillRef {
  tier: "partial";
  domain: "arithmetic";
  operation: "skipcount" | "pattern" | "family" | "unknown";
  structure: "sequence" | "linear-pattern" | "structural" | "rollup";
  patternMeta?: Record<string, unknown>;
}

export interface FallbackSkillRef {
  tier: "fallback";
  domain: "arithmetic";
  operation: "unknown";
  structure: "step";
  rawStepHash: string;
}

export interface RawEngineEvent {
  schemaVersion: VersionTag;
  eventSeq: number;
  eventType:
    | "SESSION_STARTED"
    | "SESSION_COMPLETED"
    | "SESSION_ABORTED"
    | "ITEM_PRESENTED"
    | "ANSWER_CORRECT"
    | "ANSWER_INCORRECT"
    | "ITEM_TIMEOUT"
    | "MODE_CHANGED"
    | "PAUSE_TOGGLED";
  timestampMs: number;
  sessionId: string;
  stepIndex: number;
  learningMode: LearningMode;
  phaseMode: PhaseMode;
  skillRef: SkillRef;
  payload: Record<string, unknown>;
}

export type CanonicalSkillId = string;

export interface CanonicalSkillRecord {
  canonicalSkillId: CanonicalSkillId;
  sourceSkillRef: SkillRef;
  registryVersion: VersionTag;
  resolutionKind: "direct" | "partial" | "fallback";
}

export interface DerivedEvidenceRecord {
  evidenceId: string;
  normalizationVersion: VersionTag;
  sessionId: string;
  canonicalSkillId: CanonicalSkillId;
  evidenceType: string;
  confidence: number;
  timestampMs: number;
  metadata: Record<string, unknown>;
}

export type MasteryState =
  | "UNSEEN"
  | "OBSERVED"
  | "EMERGING"
  | "DEVELOPING"
  | "STABLE"
  | "FLUENT"
  | "MASTERED"
  | "FRAGILE"
  | "REGRESSING";

export interface MasteryRecord {
  canonicalSkillId: CanonicalSkillId;
  masteryVersion: VersionTag;
  state: MasteryState;
  confidence: number;
  lastUpdatedMs: number;
  metadata: Record<string, unknown>;
}

export interface AchievementMeaningRecord {
  meaningId: string;
  meaningVersion: VersionTag;
  canonicalSkillId: CanonicalSkillId;
  category: string;
  timestampMs: number;
  metadata: Record<string, unknown>;
}

export interface RewardSignalRecord {
  signalId: string;
  signalVersion: VersionTag;
  signalType: string;
  canonicalSkillId?: CanonicalSkillId;
  timestampMs: number;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface SessionBundle {
  schemaVersion: VersionTag;
  sessionId: string;
  startTimestampMs: number;
  endTimestampMs: number;
  endReason: string;
  learningMode: LearningMode;
  phaseModeCounts: Record<string, number>;
  totals: {
    itemsPresented: number;
    correct: number;
    incorrect: number;
    timeouts: number;
  };
  timingStats: {
    avgResponseTimeMs: number;
    medianResponseTimeMs: number;
  };
  uniqueSkillRefCount: number;
  rawEventCount: number;
}
