export type FractionSettings = {
  enableFractions: boolean;
  denominators: number[];
  simplifyRequired: boolean;
};

export const DEFAULT_FRACTION_SETTINGS: FractionSettings = {
  enableFractions: false,
  denominators: [2, 3, 4, 5],
  simplifyRequired: true,
};
