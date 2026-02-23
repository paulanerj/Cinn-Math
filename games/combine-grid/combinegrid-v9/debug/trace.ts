
export type TraceTag =
  | 'INPUT'
  | 'ENGINE'
  | 'STATE'
  | 'GRAVITY'
  | 'OVERLAY'
  | 'UNDO'
  | 'ERROR';

export type TraceEvent = {
  ts: number;        // performance.now()
  wall: number;      // Date.now() (helps compare to external logs)
  tag: TraceTag;
  name: string;
  actionId: string;
  detail?: any;
};

const MAX_BUFFER = 800;
let buffer: TraceEvent[] = [];
let actionCounter = 0;

export const Trace = {
  enabled: true,

  newActionId(): string {
    return `act_${++actionCounter}_${Math.random().toString(36).substring(7)}`;
  },

  log(e: Omit<TraceEvent, 'ts' | 'wall'>): void {
    if (!this.enabled) return;

    const event: TraceEvent = { ...e, ts: performance.now(), wall: Date.now() };

    buffer.push(event);
    if (buffer.length > MAX_BUFFER) buffer.shift();

    const time = (event.ts / 1000).toFixed(3);

    console.log(
      `%c[${time}] [${event.tag}] [${event.actionId}] ${event.name}`,
      this.getTagStyle(event.tag),
      event.detail || ''
    );
  },

  getTagStyle(tag: TraceTag): string {
    switch (tag) {
      case 'INPUT':   return 'color: #818cf8; font-weight: bold; background: #1e1b4b; padding: 1px 4px;';
      case 'ENGINE':  return 'color: #fbbf24; font-weight: bold; background: #451a03; padding: 1px 4px;';
      case 'GRAVITY': return 'color: #f472b6; font-weight: bold; background: #500724; padding: 1px 4px;';
      case 'STATE':   return 'color: #4ade80; font-weight: bold; background: #064e3b; padding: 1px 4px;';
      case 'UNDO':    return 'color: #a855f7; font-weight: bold; background: #2e1065; padding: 1px 4px;';
      case 'OVERLAY': return 'color: #2dd4bf; font-weight: bold; background: #042f2e; padding: 1px 4px;';
      case 'ERROR':   return 'color: #ffffff; font-weight: bold; background: #ef4444; padding: 1px 4px;';
      default:        return 'color: #71717a;';
    }
  },

  dump(): TraceEvent[] {
    return [...buffer];
  },

  clear(): void {
    buffer = [];
  }
};
