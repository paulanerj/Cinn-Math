/** Shared tile colour / style helpers */
export type TileKind = 'number' | 'bomb' | 'trophy' | 'op' | 'blank' | 'stone' | 'empty';

export function tileBaseClass(kind: TileKind): string {
  switch (kind) {
    case 'bomb':   return 'bg-red-500 text-white';
    case 'trophy': return 'bg-yellow-400 text-yellow-900';
    case 'stone':  return 'bg-gray-500 text-gray-200';
    case 'blank':  return 'bg-gray-200 text-gray-400';
    case 'empty':  return 'bg-transparent';
    case 'op':     return 'bg-purple-400 text-white';
    default:       return 'bg-white text-gray-900';
  }
}

export function numberTileColour(val: number): string {
  if (val === 0) return 'bg-slate-200 text-slate-500';
  if (val === 1) return 'bg-blue-100 text-blue-700';
  if (val <= 3)  return 'bg-green-200 text-green-900';
  if (val <= 6)  return 'bg-lime-200 text-lime-900';
  if (val <= 9)  return 'bg-amber-200 text-amber-900';
  return 'bg-orange-300 text-orange-900';
}
