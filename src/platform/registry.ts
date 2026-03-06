
export const registry: Record<string, () => Promise<any>> = { 
  'combine-grid':()=>import('../../games/combine-grid'),
  'combine-grid-vnext':()=>import('../../games/combine-grid-vnext'),
  'speed-grid-sky-arcade':()=>import('../../games/speed-grid-sky-arcade'),
  'speed-grid':()=>import('../../games/speed-grid')
};
