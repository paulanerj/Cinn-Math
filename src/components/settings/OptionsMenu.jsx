import React, { useState, useEffect, useRef } from 'react';
import { CurriculumEditor } from './CurriculumEditor.jsx';

const PRESETS = [
  { id: 'p1', name: 'Beginner Arithmetic',            config: { learningMode: 'standard',      opsEnabled: {'+': true, '-': false, '×': false, '÷': false}, rangeMin: 0, rangeMax: 10,  modifiersPerStep: 1, timerOn: false } },
  { id: 'p2', name: 'Addition & Subtraction Practice', config: { learningMode: 'standard',      opsEnabled: {'+': true, '-': true,  '×': false, '÷': false}, rangeMin: 0, rangeMax: 20,  modifiersPerStep: 1, timerOn: true  } },
  { id: 'p3', name: 'Multiplication Tables',           config: { learningMode: 'multiplication', multBase: 4, multMaxFactor: 12, timerOn: true } },
  { id: 'p4', name: 'Skip Counting Trainer',           config: { learningMode: 'skipcount',     skipBase: 5, rangeMin: 0, rangeMax: 100, timerOn: true } },
];

// ============================================================
// MODULE: OptionsMenu
// PURPOSE: Main config editor UI.
// STATE OWNERSHIP: Manages a `temp` copy of the config.
//   Mutations do not hit the main game loop until onApply fires.
// ============================================================
export const OptionsMenu = ({ config, isOpen, onClose, onApply }) => {
  const [temp, setTemp] = useState(config);
  const [activeTab, setActiveTab] = useState('Game & Timing');
  const [isProfessorMode, setIsProfessorMode] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const tabsRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setTemp(JSON.parse(JSON.stringify(config)));
      setIsProfessorMode(false);
      setActiveTab('Game & Timing');
      setToastMsg('');
    }
  }, [config, isOpen]);

  const onMouseDown = (e) => { isDragging.current = true; startX.current = e.pageX - tabsRef.current.offsetLeft; scrollLeftPos.current = tabsRef.current.scrollLeft; };
  const onMouseMove = (e) => { if (!isDragging.current) return; e.preventDefault(); const x = e.pageX - tabsRef.current.offsetLeft; tabsRef.current.scrollLeft = scrollLeftPos.current - (x - startX.current) * 2; };
  const onMouseUpOrLeave = () => { isDragging.current = false; };
  const onWheel = (e) => { if (tabsRef.current) tabsRef.current.scrollLeft += e.deltaY; };

  const update = (key, value) => setTemp(prev => ({ ...prev, [key]: value }));

  const updateOp = (op, value) => {
    const newOps = { ...temp.opsEnabled, [op]: value };
    const activeOps = Object.keys(newOps).filter(k => newOps[k]);
    if (activeOps.length === 0) return;
    if (temp.learningMode === 'standard' && activeOps.length === 1 && activeOps[0] === '×') {
      setTemp(prev => ({ ...prev, opsEnabled: newOps, learningMode: 'multiplication' }));
      setToastMsg('Multiplication Trainer Activated! Engine auto-switched to table traversal mode.');
      setTimeout(() => setToastMsg(''), 5000);
    } else {
      setTemp(prev => ({ ...prev, opsEnabled: newOps }));
    }
  };

  const applyPreset = (preset) => {
    setTemp(prev => ({ ...prev, ...preset.config }));
    setToastMsg(`Loaded Preset: ${preset.name}`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const addPhase    = () => update('phaseSequence', [...temp.phaseSequence, { mode: 'normal', count: 3 }]);
  const updatePhase = (index, key, val) => { const s = [...temp.phaseSequence]; s[index][key] = val; update('phaseSequence', s); };
  const removePhase = (index) => update('phaseSequence', temp.phaseSequence.filter((_, i) => i !== index));

  if (!isOpen) return null;

  // LLM GUARDRAIL: Locked phase modes block QMM/Dark UI elements.
  const isLockedPhaseMode = temp.learningMode === 'multiplication' || temp.learningMode === 'pattern';

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay-scrim)] backdrop-blur-sm z-[200] flex items-center justify-center p-4 lg:p-12">
      <div className="sa-card w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-[var(--sa-ui-border)] shrink-0 bg-[var(--sa-ui-bg)] z-20">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[var(--sa-ui-text)]">Settings Dashboard</h2>
            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-full border border-[var(--sa-ui-border)] shadow-sm hover:shadow-md transition-shadow">
              <span className="text-xs font-bold text-[var(--sa-ui-accent)] uppercase">Instructor Mode</span>
              <input type="checkbox" checked={isProfessorMode} onChange={e => setIsProfessorMode(e.target.checked)} className="w-5 h-5 accent-[var(--sa-ui-accent)] cursor-pointer" />
            </label>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[var(--sa-ui-bg)] text-[var(--sa-ui-text)] relative">
          {toastMsg && (
            <div className="fixed top-8 left-1/2 -translate-x-1/2 sa-toast z-[300] animate-bounce-gentle text-sm font-bold text-center flex items-center gap-3 w-max max-w-[90%]">
              <span className="text-2xl">⚡</span>
              <span className="text-left">{toastMsg}</span>
            </div>
          )}

          {/* 3-Column Settings Layout */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* COLUMN 1: LEARNING MODE */}
            <div className="flex-1 space-y-4">
              <div className="sa-settings-panel h-full border-t-4 border-t-[var(--sa-primary)]">
                <h3 className="text-[10px] font-black tracking-widest text-[var(--sa-ui-text-muted)] uppercase mb-4 opacity-60 flex items-center gap-2">
                  <span className="text-lg">🎮</span> Layer 1 — Learning Mode
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'standard',       icon: '➕', label: 'Standard Arithmetic',     sub: 'Mixed operations',       cls: 'mode-standard' },
                    { id: 'multiplication', icon: '✖',  label: 'Multiplication Trainer',   sub: 'Times tables traversal', cls: 'mode-multiply' },
                    { id: 'skipcount',      icon: '⏭',  label: 'Skip Counting',            sub: 'Multiples practice',     cls: 'mode-skip' },
                    { id: 'pattern',        icon: '🔷', label: 'Pattern Logic',             sub: 'Sequence reasoning',     cls: 'mode-pattern' },
                  ].map(m => (
                    <button key={m.id} onClick={() => update('learningMode', m.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${temp.learningMode === m.id ? `${m.cls} shadow-md scale-[1.02] z-10 relative` : 'bg-white border-[var(--sa-ui-border)] hover:bg-slate-50 grayscale opacity-70'}`}>
                      <div className="text-3xl">{m.icon}</div>
                      <div>
                        <div className="font-black leading-tight text-base">{m.label}</div>
                        <div className="text-[10px] font-bold mt-1 opacity-80 uppercase tracking-wide">{m.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* COLUMN 2: MODE CONFIGURATION */}
            <div className="flex-1 space-y-4">
              <div className="sa-settings-panel h-full border-t-4 border-t-[var(--sa-ui-accent)]">
                <h3 className="text-[10px] font-black tracking-widest text-[var(--sa-ui-text-muted)] uppercase mb-4 opacity-60 flex items-center gap-2 border-b border-[var(--sa-ui-border)] pb-3">
                  <span className="text-lg">⚙️</span> Layer 2 — Context Config
                </h3>

                {temp.learningMode === 'standard' && (
                  <div className="space-y-6 animate-pop">
                    <div>
                      <label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-3">Allowed Operations</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['+', '-', '×', '÷'].map(op => (
                          <button key={op} onClick={() => updateOp(op, !temp.opsEnabled[op])}
                            className={`px-4 py-3 rounded-xl font-black text-sm transition-all text-center ${temp.opsEnabled[op] ? 'op-enabled' : 'op-disabled hover:border-[var(--sa-ui-accent-soft)]'}`}>
                            {op === '+' ? '+ Addition' : op === '-' ? '− Subtraction' : op === '×' ? '× Multiplication' : '÷ Division'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Smallest Number</label><input type="number" value={temp.rangeMin} onChange={e => update('rangeMin', Number(e.target.value))} className="sa-input w-full text-center text-lg" /></div>
                      <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Largest Number</label><input type="number" value={temp.rangeMax} onChange={e => update('rangeMax', Number(e.target.value))} className="sa-input w-full text-center text-lg" /></div>
                    </div>
                    <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Modifiers Per Step (Max)</label><input type="number" min="1" max="3" value={temp.modifiersPerStep} onChange={e => update('modifiersPerStep', Number(e.target.value))} className="sa-input w-full text-center text-lg" /></div>
                  </div>
                )}

                {temp.learningMode === 'multiplication' && (
                  <div className="grid grid-cols-2 gap-5 animate-pop relative">
                    <div className="col-span-2 text-[11px] font-bold text-center bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 mb-2 shadow-sm">
                      🔒 Reasoning-First Mode: QMM & Dark Mode disabled.
                    </div>
                    <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Base Table</label><select value={temp.multBase || 4} onChange={e => update('multBase', Number(e.target.value))} className="sa-input w-full text-center text-lg">{[2,3,4,5,6,7,8,9,10,11,12].map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                    <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Traversal Range</label><select value={temp.multMaxFactor || 12} onChange={e => update('multMaxFactor', Number(e.target.value))} className="sa-input w-full text-center text-lg"><option value={10}>1-10</option><option value={12}>1-12</option><option value={15}>1-15</option></select></div>
                    <div className="col-span-2 mt-2">
                      <label className="flex items-center justify-between cursor-pointer p-4 bg-[var(--sa-ui-bg)] rounded-xl border border-[var(--sa-ui-border)] hover:bg-slate-100 transition-colors">
                        <span className="text-[12px] font-bold text-[var(--sa-ui-text)] uppercase">Allow Reverse Traversal</span>
                        <input type="checkbox" checked={temp.multAllowReverse ?? true} onChange={e => update('multAllowReverse', e.target.checked)} className="w-6 h-6 accent-[var(--sa-ui-accent)] cursor-pointer" />
                      </label>
                    </div>
                  </div>
                )}

                {temp.learningMode === 'skipcount' && (
                  <div className="grid grid-cols-2 gap-5 animate-pop">
                    <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Skip Base</label><select value={temp.skipBase || 7} onChange={e => update('skipBase', Number(e.target.value))} className="sa-input w-full text-center text-lg">{[2,3,4,5,6,7,8,9,10,12].map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                    <div className="row-span-2">
                      <label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Range</label>
                      <div className="flex flex-col gap-3">
                        <input type="number" placeholder="Start" value={temp.rangeMin} onChange={e => update('rangeMin', Number(e.target.value))} className="sa-input w-full text-center text-lg" />
                        <input type="number" placeholder="End"   value={temp.rangeMax} onChange={e => update('rangeMax', Number(e.target.value))} className="sa-input w-full text-center text-lg" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Oscillation</label>
                      <button onClick={() => update('skipOscillation', !(temp.skipOscillation ?? true))} className={`w-full p-3 rounded-xl font-black text-sm transition-all ${temp.skipOscillation ?? true ? 'op-enabled' : 'op-disabled'}`}>
                        {temp.skipOscillation ?? true ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                )}

                {temp.learningMode === 'pattern' && (
                  <div className="grid grid-cols-2 gap-5 animate-pop opacity-60">
                    <div className="col-span-2 text-[11px] font-bold text-center bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-200 mb-2 shadow-sm">
                      🔒 Reasoning-First Mode: QMM, Dark Mode, & Timers disabled.
                    </div>
                    <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Pattern Complexity</label><select disabled className="sa-input w-full text-center text-lg"><option>Standard</option></select></div>
                    <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Seq. Length</label><input type="number" disabled value={temp.patternLength || 4} className="sa-input w-full text-center text-lg" /></div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: GAME STRUCTURE */}
            <div className="flex-1 space-y-4 flex flex-col">
              <div className="sa-settings-panel h-full border-t-4 border-t-[var(--sa-warning)]">
                <h3 className="text-[10px] font-black tracking-widest text-[var(--sa-ui-text-muted)] uppercase mb-4 opacity-60 flex items-center gap-2 border-b border-[var(--sa-ui-border)] pb-3">
                  <span className="text-lg">📐</span> Game Structure
                </h3>
                <div className="grid grid-cols-2 gap-5">
                  <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Total Steps</label><select value={temp.totalSteps} onChange={e => update('totalSteps', Number(e.target.value))} className="sa-input w-full text-lg"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></div>
                  <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Base Mode</label><select value={temp.activeMode} onChange={e => update('activeMode', e.target.value)} className="sa-input w-full text-lg"><option value="normal">Normal</option><option value="survival">Survival</option></select></div>
                  {temp.learningMode === 'standard' && (
                    <>
                      <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Goal Number</label><input type="number" value={temp.targetNumber} onChange={e => update('targetNumber', Number(e.target.value))} className="sa-input w-full text-center text-lg" /></div>
                      <div><label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Allowed Offset (±)</label><input type="number" value={temp.targetFlex} onChange={e => update('targetFlex', Number(e.target.value))} className="sa-input w-full text-center text-lg" /></div>
                    </>
                  )}
                </div>
                <label className="flex items-center justify-between cursor-pointer p-4 bg-[var(--sa-ui-bg)] rounded-xl border border-[var(--sa-ui-border)] hover:bg-slate-100 mt-6 transition-colors">
                  <span className="font-bold text-[var(--sa-ui-text)] uppercase text-[12px]">Mute Audio</span>
                  <input type="checkbox" checked={temp.isMuted} onChange={e => update('isMuted', e.target.checked)} className="w-6 h-6 accent-[var(--sa-ui-accent)] cursor-pointer" />
                </label>
              </div>
            </div>
          </div>

          {/* INSTRUCTOR TABS */}
          {isProfessorMode && (
            <div className="mt-8 animate-pop">
              <div className="sa-settings-panel overflow-hidden border-t-4 border-t-[#8B5CF6]">
                <div className="relative border-b border-[var(--sa-ui-border)] -mx-4 -mt-4 mb-6 bg-[var(--sa-ui-bg)]">
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--sa-ui-bg)] to-transparent pointer-events-none z-10" />
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--sa-ui-bg)] to-transparent pointer-events-none z-10" />
                  <div className="sa-tabbar cursor-grab active:cursor-grabbing px-6 pt-4 bg-transparent border-none"
                    ref={tabsRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                    onMouseUp={onMouseUpOrLeave} onMouseLeave={onMouseUpOrLeave} onWheel={onWheel}>
                    {['Game & Timing', 'Phase Sequence', 'Curriculum', 'Advanced & Audio'].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 rounded-t-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-4 ${activeTab === tab ? 'sa-tab-active border-[var(--sa-ui-accent)]' : 'sa-tab border-transparent hover:bg-slate-200'}`}>
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {activeTab === 'Game & Timing' && (
                  <div className="space-y-4 animate-pop max-w-2xl mx-auto">
                    <div className="sa-card p-6 shadow-sm border border-[var(--sa-ui-border)]">
                      <label className="flex items-center justify-between cursor-pointer mb-6 border-b border-[var(--sa-ui-border)] pb-4">
                        <span className="font-bold text-[var(--sa-ui-text)] uppercase text-sm tracking-wide">Enable Timers</span>
                        <input type="checkbox" checked={temp.timerOn} disabled={isLockedPhaseMode} onChange={e => update('timerOn', e.target.checked)} className="w-6 h-6 accent-[var(--sa-ui-accent)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" />
                      </label>
                      <div className="grid grid-cols-2 gap-6">
                        {['quickMindInterval', 'darkModeInterval'].map((key, idx) => (
                          <div key={key} className={`relative ${isLockedPhaseMode ? 'opacity-50 grayscale' : ''}`}>
                            {isLockedPhaseMode && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-lg border border-[var(--sa-warning)]"><span className="text-[10px] font-black text-[var(--sa-ui-text)] text-center px-1">🚫 Disabled in this mode</span></div>}
                            <label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">{idx === 0 ? 'Quick Mind Interval (s)' : 'Dark Mode Interval (s)'}</label>
                            <input type="number" value={temp[key]} onChange={e => update(key, Number(e.target.value))} disabled={!temp.timerOn || isLockedPhaseMode} className="sa-input w-full text-center text-xl disabled:opacity-50" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'Phase Sequence' && (
                  <div className={`sa-card p-6 shadow-sm border border-[var(--sa-ui-border)] animate-pop relative max-w-3xl mx-auto ${isLockedPhaseMode ? 'opacity-50 grayscale' : ''}`}>
                    {isLockedPhaseMode && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[2px] rounded-xl">
                        <span className="bg-[var(--sa-card)] border-2 border-[var(--sa-warning)] text-[var(--sa-ui-text)] text-sm px-6 py-4 rounded-xl font-black shadow-2xl text-center uppercase tracking-widest">
                          🚫 QMM & Dark Mode<br/>disabled in this mode
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-6 border-b border-[var(--sa-ui-border)] pb-4">
                      <label className="text-xs font-black tracking-widest text-[var(--sa-ui-text-muted)] uppercase">Phase Sequence Editor</label>
                      <button onClick={addPhase} disabled={isLockedPhaseMode} className="sa-btn px-5 py-2 text-xs font-bold bg-[var(--sa-ui-panel)] text-[var(--sa-ui-accent)] border-[var(--sa-ui-accent)]">+ Add Phase</button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
                      {temp.phaseSequence.map((phase, i) => {
                        let phaseClass = 'phase-normal';
                        if (phase.mode === 'qmm') phaseClass = 'phase-qmm';
                        if (phase.mode === 'dark') phaseClass = 'phase-dark';
                        return (
                          <div key={i} className={`flex gap-4 items-center p-3 rounded-xl border-2 ${phaseClass}`}>
                            <select value={phase.mode} disabled={isLockedPhaseMode} onChange={e => updatePhase(i, 'mode', e.target.value)} className="sa-input flex-1 p-3 text-sm font-black uppercase tracking-wider bg-white/80">
                              <option value="normal">Normal Mode</option>
                              <option value="qmm">Quick Mind</option>
                              <option value="dark">Dark Mode</option>
                            </select>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase opacity-60">Count</span>
                              <input type="number" min="1" disabled={isLockedPhaseMode} value={phase.count} onChange={e => updatePhase(i, 'count', Number(e.target.value))} className="sa-input w-20 p-3 text-center text-lg bg-white/80" />
                            </div>
                            <button disabled={isLockedPhaseMode} onClick={() => removePhase(i)} className="p-3 text-[var(--sa-error)] font-black text-xl hover:scale-110 transition-transform">&times;</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'Curriculum' && (
                  <div className="animate-pop space-y-6 max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
                    <div className="flex-1 sa-card p-6 border-2 border-[var(--sa-ui-accent-soft)] shadow-md bg-[var(--sa-ui-bg)]">
                      <label className="text-[11px] font-black tracking-widest text-[var(--sa-ui-accent)] uppercase block mb-4 border-b border-[var(--sa-ui-border)] pb-3">📚 Preset Curriculum Library</label>
                      <div className="grid grid-cols-1 gap-3">
                        {PRESETS.map(p => (
                          <button key={p.id} onClick={() => applyPreset(p)} className="text-left px-5 py-4 rounded-xl border-2 border-[var(--sa-ui-border)] bg-white hover:border-[var(--sa-ui-accent)] hover:shadow-md transition-all font-bold text-[var(--sa-ui-text)] flex justify-between items-center text-sm group">
                            {p.name}
                            <span className="text-[10px] font-black uppercase text-[var(--sa-ui-accent)] bg-[var(--sa-ui-accent-soft)] px-3 py-1 rounded-full border border-[var(--sa-ui-accent)] group-hover:bg-[var(--sa-ui-accent)] group-hover:text-white transition-colors">Load</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-[2] sa-card p-6 shadow-sm border border-[var(--sa-ui-border)]">
                      <label className="text-[11px] font-bold text-[var(--sa-ui-text-muted)] uppercase block mb-2">Progression Engine</label>
                      <select value={temp.progressionMode} onChange={e => update('progressionMode', e.target.value)} className="sa-input w-full mb-6 text-lg">
                        <option value="curriculum">Curriculum (Lesson Plan)</option>
                        <option value="adaptive">Adaptive (Dynamic Engine)</option>
                      </select>
                      {temp.progressionMode === 'curriculum' && <CurriculumEditor />}
                    </div>
                  </div>
                )}

                {activeTab === 'Advanced & Audio' && (
                  <div className="animate-pop space-y-4 max-w-2xl mx-auto">
                    <label className="sa-card p-6 shadow-sm border border-[var(--sa-ui-border)] flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                      <span className="font-bold text-[var(--sa-ui-text)] uppercase tracking-wide">Enable Logic Variables (x)</span>
                      <input type="checkbox" checked={temp.enableVariables} onChange={e => update('enableVariables', e.target.checked)} className="w-6 h-6 accent-[var(--sa-ui-accent)] cursor-pointer" />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 pt-5 border-t border-[var(--sa-ui-border)] flex gap-4 bg-white shrink-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
          <button onClick={onClose} className="flex-1 py-4 sa-btn text-[var(--sa-ui-text-muted)] font-black text-lg bg-[var(--sa-ui-bg)]">Cancel</button>
          <button onClick={() => onApply(temp)} className="flex-[2] py-4 sa-btn !bg-[var(--sa-ui-accent)] !text-white !border-[var(--sa-ui-accent)] font-black text-lg shadow-xl hover:shadow-2xl">Apply & Restart Session</button>
        </div>
      </div>
    </div>
  );
};
