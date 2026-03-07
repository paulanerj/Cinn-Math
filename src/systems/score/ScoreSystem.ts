export type ScoreEvent =
  | { type: 'CHAIN_CLEARED'; chainLength: number; target: number }
  | { type: 'BOMB_USED' }
  | { type: 'TROPHY_EARNED' }
  | { type: 'ROUND_COMPLETE'; roundScore: number }
  | { type: 'STALEMATE' };

export type ScoreState = {
  total: number;
  roundScore: number;
  trophies: number;
  chains: number;
  longestChain: number;
};

function initialState(): ScoreState {
  return { total: 0, roundScore: 0, trophies: 0, chains: 0, longestChain: 0 };
}

/**
 * ScoreSystem — pure functional score accumulation.
 */
export class ScoreSystem {
  static init(): ScoreState {
    return initialState();
  }

  static apply(state: ScoreState, event: ScoreEvent): ScoreState {
    switch (event.type) {
      case 'CHAIN_CLEARED': {
        const base = event.chainLength * 10;
        const bonus = event.chainLength >= 4 ? (event.chainLength - 3) * 15 : 0;
        const points = base + bonus;
        return {
          ...state,
          total: state.total + points,
          roundScore: state.roundScore + points,
          chains: state.chains + 1,
          longestChain: Math.max(state.longestChain, event.chainLength),
        };
      }
      case 'BOMB_USED':
        return { ...state, total: Math.max(0, state.total - 5), roundScore: Math.max(0, state.roundScore - 5) };
      case 'TROPHY_EARNED':
        return { ...state, trophies: state.trophies + 1, total: state.total + 50 };
      case 'ROUND_COMPLETE':
        return { ...state, total: state.total + event.roundScore };
      case 'STALEMATE':
        return { ...state, roundScore: Math.max(0, state.roundScore - 20) };
      default:
        return state;
    }
  }

  static resetRound(state: ScoreState): ScoreState {
    return { ...state, roundScore: 0 };
  }
}
