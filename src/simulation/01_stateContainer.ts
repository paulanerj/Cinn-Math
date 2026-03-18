import {
  ParentRewardPlatformState,
  LearnerProfile,
  SkillStateStore,
  EvidenceStore,
  SessionStore,
  AchievementStore,
  RewardSignalStore,
} from "../models/state";

import {
  DerivedEvidenceRecord,
  MasteryRecord,
  AchievementMeaningRecord,
  RewardSignalRecord,
  CanonicalSkillRecord,
} from "../contracts/types";

export class InMemoryStateContainer implements ParentRewardPlatformState {
  learnerProfiles: Record<string, LearnerProfile> = {};
  skillState: SkillStateStore = { canonicalSkills: {}, mastery: {} };
  evidence: EvidenceStore = { derivedEvidence: [], unresolvedFallbackEvidence: [] };
  sessions: SessionStore = { sessions: [] };
  achievements: AchievementStore = { meanings: [] };
  rewardSignals: RewardSignalStore = { signals: [] };
  deadLetterQueue: Record<string, unknown>[] = [];

  // --- Commit Methods ---

  commitCanonicalSkill(record: CanonicalSkillRecord) {
    if (record.resolutionKind !== "fallback") {
      this.skillState.canonicalSkills[record.canonicalSkillId] = record;
    }
  }

  commitEvidence(record: DerivedEvidenceRecord, isFallback: boolean) {
    if (isFallback) {
      this.evidence.unresolvedFallbackEvidence.push(record);
    } else {
      this.evidence.derivedEvidence.push(record);
    }
  }

  commitMastery(record: MasteryRecord) {
    this.skillState.mastery[record.canonicalSkillId] = record;
  }

  commitAchievement(record: AchievementMeaningRecord) {
    this.achievements.meanings.push(record);
  }

  commitRewardSignal(record: RewardSignalRecord) {
    this.rewardSignals.signals.push(record);
  }

  // --- Deterministic Verification ---

  serialize(): string {
    const stateSnapshot = {
      skills: Object.keys(this.skillState.canonicalSkills).sort(),
      mastery: Object.values(this.skillState.mastery).sort((a, b) =>
        a.canonicalSkillId.localeCompare(b.canonicalSkillId)
      ),
      evidenceCount: this.evidence.derivedEvidence.length,
      fallbackCount: this.evidence.unresolvedFallbackEvidence.length,
      achievements: this.achievements.meanings.map((m) => m.meaningId).sort(),
      signals: this.rewardSignals.signals.map((s) => s.signalType).sort(),
      quarantinedEvents: [...this.deadLetterQueue].sort(
        (a, b) => (a.eventSeq as number) - (b.eventSeq as number)
      ),
    };
    return JSON.stringify(stateSnapshot);
  }
}
