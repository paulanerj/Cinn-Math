import {
  AchievementMeaningRecord,
  CanonicalSkillRecord,
  DerivedEvidenceRecord,
  MasteryRecord,
  RewardSignalRecord,
  SessionBundle,
} from "../contracts/types";

export interface LearnerProfile {
  learnerId: string;
  createdAtMs: number;
  metadata: Record<string, unknown>;
}

export interface SkillStateStore {
  canonicalSkills: Record<string, CanonicalSkillRecord>;
  mastery: Record<string, MasteryRecord>;
}

export interface EvidenceStore {
  derivedEvidence: DerivedEvidenceRecord[];
  unresolvedFallbackEvidence: DerivedEvidenceRecord[];
}

export interface SessionStore {
  sessions: SessionBundle[];
}

export interface AchievementStore {
  meanings: AchievementMeaningRecord[];
}

export interface RewardSignalStore {
  signals: RewardSignalRecord[];
}

export interface ParentRewardPlatformState {
  learnerProfiles: Record<string, LearnerProfile>;
  skillState: SkillStateStore;
  evidence: EvidenceStore;
  sessions: SessionStore;
  achievements: AchievementStore;
  rewardSignals: RewardSignalStore;
  deadLetterQueue: Record<string, unknown>[];
}
