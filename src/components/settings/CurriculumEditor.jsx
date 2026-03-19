import React, { useState, useEffect } from 'react';
import { CurriculumValidator } from './CurriculumValidator.js';
import { DifficultyVisualizer } from './DifficultyVisualizer.jsx';
import { DEFAULT_CURRICULUM_BLOCKS } from '../../engine/Curriculum.js';

export const CurriculumEditor = () => {
  const [blocks, setBlocks] = useState([]);
  const [errors, setErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('speedmath_curriculum');
    if (stored) {
      try { setBlocks(JSON.parse(stored)); } catch(e) { setBlocks(window.CURRICULUM_BLOCKS); }
    } else {
      setBlocks(window.CURRICULUM_BLOCKS);
    }
  }, []);

  const handleSave = () => {
    const validation = CurriculumValidator.validate(blocks);
    if (!validation.valid) { setErrors(validation.errors); setSuccessMsg(''); return; }
    setErrors([]);
    localStorage.setItem('speedmath_curriculum', JSON.stringify(blocks));
    window.CURRICULUM_BLOCKS = blocks;
    setSuccessMsg('Curriculum saved & validated successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const updateBlock = (index, key, value) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [key]: value };
    setBlocks(newBlocks);
  };

  const addBlock = () => {
    const last = blocks[blocks.length - 1];
    setBlocks([...blocks, {
      start: last ? last.end + 1 : 1, end: last ? last.end + 5 : 5,
      rangeMax: 10, modifiers: 2, operations: '+-', timer: 10, distractors: 2, variables: false
    }]);
  };

  const removeBlock = (index) => setBlocks(blocks.filter((_, i) => i !== index));

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(blocks, null, 2));
    const el = document.createElement('a');
    el.setAttribute('href', dataStr);
    el.setAttribute('download', 'speedmath_curriculum.json');
    el.click();
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const validation = CurriculumValidator.validate(parsed);
        if (!validation.valid) { setErrors(validation.errors); return; }
        setBlocks(parsed); setErrors([]);
      } catch(err) { setErrors(['Invalid JSON file format.']); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="bg-[var(--sa-error)] text-[var(--sa-text-inverse)] p-3 rounded-xl text-xs font-bold">
          {errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}
      {successMsg && (
        <div className="bg-[var(--sa-success)] text-[var(--sa-text-inverse)] p-3 rounded-xl text-xs font-bold text-center">
          {successMsg}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto space-y-3 p-2 rounded-xl bg-[var(--sa-ui-bg)] border border-[var(--sa-ui-border)] scrollbar-hide">
        {blocks.map((block, i) => (
          <div key={i} className="sa-card p-3 grid grid-cols-2 gap-2 text-xs relative border border-[var(--sa-ui-border)] shadow-sm">
            <button onClick={() => removeBlock(i)} className="absolute top-1 right-2 text-[var(--sa-error)] font-black text-lg leading-none hover:scale-110">&times;</button>
            <div className="col-span-2 font-bold text-[var(--sa-ui-text-muted)] mb-1 border-b border-[var(--sa-ui-border)] pb-1">Block {i + 1}</div>
            <label className="flex flex-col text-[var(--sa-ui-text)] font-bold">Start Step <input type="number" value={block.start} onChange={e => updateBlock(i, 'start', parseInt(e.target.value))} className="sa-input p-1 rounded mt-1" /></label>
            <label className="flex flex-col text-[var(--sa-ui-text)] font-bold">End Step <input type="number" value={block.end} onChange={e => updateBlock(i, 'end', parseInt(e.target.value))} className="sa-input p-1 rounded mt-1" /></label>
            <label className="flex flex-col text-[var(--sa-ui-text)] font-bold">Range Max <input type="number" value={block.rangeMax} onChange={e => updateBlock(i, 'rangeMax', parseInt(e.target.value))} className="sa-input p-1 rounded mt-1" /></label>
            <label className="flex flex-col text-[var(--sa-ui-text)] font-bold">Timer (s) <input type="number" value={block.timer} onChange={e => updateBlock(i, 'timer', parseInt(e.target.value))} className="sa-input p-1 rounded mt-1" /></label>
            <label className="flex flex-col text-[var(--sa-ui-text)] font-bold">Modifiers <input type="number" max="3" value={block.modifiers} onChange={e => updateBlock(i, 'modifiers', parseInt(e.target.value))} className="sa-input p-1 rounded mt-1" /></label>
            <label className="flex flex-col text-[var(--sa-ui-text)] font-bold">Distractors <input type="number" max="3" value={block.distractors} onChange={e => updateBlock(i, 'distractors', parseInt(e.target.value))} className="sa-input p-1 rounded mt-1" /></label>
            <label className="flex flex-col text-[var(--sa-ui-text)] font-bold">Ops (+-×÷) <input type="text" value={block.operations} onChange={e => updateBlock(i, 'operations', e.target.value)} className="sa-input p-1 rounded mt-1" /></label>
            <label className="flex items-center gap-2 mt-4 text-[var(--sa-ui-text)] font-bold">
              <input type="checkbox" checked={block.variables} onChange={e => updateBlock(i, 'variables', e.target.checked)} className="accent-[var(--sa-primary)] w-4 h-4" /> Variables
            </label>
          </div>
        ))}
      </div>

      <DifficultyVisualizer curriculum={blocks} />

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button onClick={addBlock} className="sa-btn py-3 text-xs font-bold bg-[var(--sa-ui-panel)]">Add Block</button>
        <button onClick={handleSave} className="sa-btn py-3 text-xs font-bold !bg-[var(--sa-primary)] !text-[var(--sa-text-inverse)] !border-[var(--sa-primary)]">Validate & Save</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1 border-t border-[var(--sa-ui-border)] pt-3">
        <button onClick={handleExport} className="sa-btn py-3 text-xs font-bold bg-[var(--sa-ui-panel)]">Export JSON</button>
        <label className="sa-btn py-3 text-xs font-bold bg-[var(--sa-ui-panel)] text-center cursor-pointer flex items-center justify-center m-0">
          Import JSON
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>
    </div>
  );
};
