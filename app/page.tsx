'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { StarfieldBg } from '@/components/Background/StarfieldBg';
import { AssemblyEditor } from '@/components/Editor/AssemblyEditor';
import { PipelineConfig } from '@/components/Pipeline/PipelineConfig';
import { PipelineTrack } from '@/components/Pipeline/PipelineTrack';
import { PipelineTable } from '@/components/Pipeline/PipelineTable';
import { HazardPanel } from '@/components/Pipeline/HazardPanel';
import { RegisterVault } from '@/components/Pipeline/RegisterVault';
import { SimulationControls } from '@/components/Controls/SimulationControls';
import { parseInstructions } from '@/lib/parser';
import { simulate } from '@/lib/simulator';
import type { SimConfig, ParseError, SimulationResult } from '@/lib/types';

const DEFAULT_CODE = `# Example program
ADD R1, R2, R3
LW R4, 0(R1)
SUB R5, R4, R1`;

type SimState = 'idle' | 'running' | 'complete';

const AUTO_RUN_INTERVAL = 1300; // ms per cycle

export default function Home() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [config, setConfig] = useState<SimConfig>({
    pipelineType: '5-stage',
    forwardingEnabled: false,
  });
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [simState, setSimState] = useState<SimState>('idle');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoRunRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-run timer
  useEffect(() => {
    if (!autoRunning || !result) return;

    autoRunRef.current = setInterval(() => {
      setCurrentCycle((prev) => {
        if (prev >= result.totalCycles) {
          setAutoRunning(false);
          setSimState('complete');
          if (autoRunRef.current) clearInterval(autoRunRef.current);
          return result.totalCycles;
        }
        return prev + 1;
      });
    }, AUTO_RUN_INTERVAL);

    return () => {
      if (autoRunRef.current) clearInterval(autoRunRef.current);
    };
  }, [autoRunning, result]);

  const handleEditorChange = useCallback((value: string) => {
    setCode(value);
    const { errors } = parseInstructions(value);
    setParseErrors(errors);
    if (simState !== 'idle') {
      setSimState('idle');
      setResult(null);
      setCurrentCycle(0);
      setAutoRunning(false);
    }
  }, [simState]);

  const handleErrors = useCallback((errors: ParseError[]) => {
    setParseErrors(errors);
  }, []);

  const handleRun = useCallback(() => {
    const { instructions, errors } = parseInstructions(code);
    if (errors.length > 0) return;

    const simResult = simulate(instructions, config);
    setResult(simResult);
    setCurrentCycle(1);
    setSimState('running');
    setAutoRunning(true);
  }, [code, config]);

  const handleStep = useCallback(() => {
    if (simState === 'idle') {
      const { instructions, errors } = parseInstructions(code);
      if (errors.length > 0) return;

      const simResult = simulate(instructions, config);
      setResult(simResult);
      setSimState('running');
      setCurrentCycle(1);
    } else if (simState === 'running' && result) {
      setAutoRunning(false);
      setCurrentCycle((prev) => {
        const next = prev + 1;
        if (next > result.totalCycles) {
          setSimState('complete');
          return result.totalCycles;
        }
        return next;
      });
    }
  }, [code, config, simState, result]);

  const handlePrev = useCallback(() => {
    if (simState === 'idle') return;
    setAutoRunning(false);
    setCurrentCycle((prev) => Math.max(1, prev - 1));
  }, [simState]);

  const handleReset = useCallback(() => {
    setSimState('idle');
    setResult(null);
    setCurrentCycle(0);
    setAutoRunning(false);
    if (autoRunRef.current) clearInterval(autoRunRef.current);
  }, []);

  const instructionRaws = useMemo(() => {
    const map = new Map<number, string>();
    if (result) {
      for (const schedule of result.schedules) {
        map.set(schedule.instruction.index, schedule.instruction.raw);
      }
    }
    return map;
  }, [result]);

  const hasErrors = parseErrors.length > 0;
  const isComplete = simState === 'complete';
  const hasHazardAtCurrentCycle = useMemo(() => {
    if (!result || currentCycle <= 0) return false;
    return result.schedules.some((schedule) =>
      schedule.cycles.some((entry) => entry.cycle === currentCycle && entry.isStall)
    );
  }, [result, currentCycle]);
  const hasForwardingAtCurrentCycle = useMemo(() => {
    if (!result || currentCycle <= 0) return false;
    return result.schedules.some((schedule) =>
      schedule.cycles.some((entry) => entry.cycle === currentCycle && entry.stage === 'EX' && entry.isForwarded)
    );
  }, [result, currentCycle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingContext =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          !!target.closest('.cm-editor'));

      if (isTypingContext) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (!hasErrors && !isComplete) handleStep();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (!hasErrors) handlePrev();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!hasErrors && !isComplete && !autoRunning) handleRun();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [autoRunning, handlePrev, handleReset, handleRun, handleStep, hasErrors, isComplete]);

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <StarfieldBg />

      {/* Header */}
      <header
        className="relative z-10 flex-shrink-0"
        style={{
          borderBottom: '1px solid oklch(0.3 0.02 260 / 30%)',
          background: 'linear-gradient(180deg, oklch(0.14 0.01 255 / 82%), oklch(0.11 0.01 255 / 74%))',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1
                  className="text-base font-bold tracking-tight"
                  style={{ color: 'oklch(0.95 0.01 260)', fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Pipeline Hazard Simulator
                </h1>
                <p className="text-[9px] tracking-wider" style={{ color: 'oklch(0.50 0.02 260)' }}>
                  CS2011 Pipeline Visualization
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {simState !== 'idle' && (
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-mono font-bold tracking-wider"
                    style={{ color: 'oklch(0.6 0.02 260)' }}
                  >
                    CYCLE
                  </span>
                  <span
                    className="text-sm font-mono font-extrabold px-2 py-0.5 rounded"
                    style={{
                      color: 'oklch(0.9 0.15 195)',
                      background: 'oklch(0.7 0.18 195 / 10%)',
                      border: '1px solid oklch(0.7 0.18 195 / 25%)',
                    }}
                  >
                    {currentCycle} / {result?.totalCycles || 0}
                  </span>
                </div>
              )}
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded"
                style={{
                  background: 'oklch(0.7 0.18 195 / 10%)',
                  color: 'oklch(0.7 0.15 195)',
                  border: '1px solid oklch(0.7 0.18 195 / 25%)',
                  fontFamily: 'var(--font-geist-mono), monospace',
                }}
              >
                MIPS
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 container mx-auto px-4 py-3 min-h-0">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 min-h-0 overflow-hidden">
          {/* Left: fixed panel */}
          <div className="h-full min-h-0 overflow-hidden flex flex-col gap-3">
            <div
              className="rounded-xl overflow-hidden flex-1 min-h-0"
              style={{
                minHeight: '170px',
                background: 'linear-gradient(180deg, oklch(0.16 0.005 240 / 78%), oklch(0.12 0.005 240 / 74%))',
                border: '1px solid oklch(0.30 0.01 240 / 32%)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <AssemblyEditor
                value={code}
                onChange={handleEditorChange}
                onErrors={handleErrors}
              />
            </div>

            <div
              className="rounded-xl p-3 space-y-3 flex-shrink-0"
              style={{
                background: 'linear-gradient(180deg, oklch(0.15 0.008 85 / 74%), oklch(0.12 0.008 85 / 72%))',
                border: '1px solid oklch(0.30 0.01 85 / 34%)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <SimulationControls
                onRun={handleRun}
                onPrev={handlePrev}
                onStep={handleStep}
                onReset={handleReset}
                hasErrors={hasErrors}
                isComplete={isComplete}
                isAutoRunning={autoRunning}
                currentCycle={currentCycle}
              />

              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'linear-gradient(180deg, oklch(0.16 0.01 165 / 68%), oklch(0.13 0.01 165 / 68%))',
                  border: '1px solid oklch(0.28 0.012 165 / 34%)',
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-widest font-semibold"
                  style={{ color: 'oklch(0.52 0.02 260)', fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Pipeline Units
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div
                    className="rounded-md px-3 py-2"
                    style={{
                      background: 'linear-gradient(180deg, oklch(0.17 0.01 32 / 78%), oklch(0.14 0.01 32 / 78%))',
                      border: `1px solid ${hasHazardAtCurrentCycle ? 'oklch(0.62 0.24 28 / 45%)' : 'oklch(0.3 0.02 260 / 35%)'}`,
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'oklch(0.72 0.05 80)' }}>
                      Hazard Detection Unit
                    </div>
                    <div className="text-[11px] font-mono" style={{ color: hasHazardAtCurrentCycle ? 'oklch(0.8 0.15 25)' : 'oklch(0.56 0.02 260)' }}>
                      {hasHazardAtCurrentCycle ? 'Hazard Active' : 'Idle'}
                    </div>
                  </div>
                  <div
                    className="rounded-md px-3 py-2"
                    style={{
                      background: 'linear-gradient(180deg, oklch(0.16 0.01 155 / 78%), oklch(0.13 0.01 155 / 78%))',
                      border: `1px solid ${hasForwardingAtCurrentCycle ? 'oklch(0.7 0.2 155 / 45%)' : 'oklch(0.3 0.02 260 / 35%)'}`,
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'oklch(0.72 0.05 80)' }}>
                      Forwarding Unit
                    </div>
                    <div className="text-[11px] font-mono" style={{ color: hasForwardingAtCurrentCycle ? 'oklch(0.8 0.15 155)' : 'oklch(0.56 0.02 260)' }}>
                      {hasForwardingAtCurrentCycle ? 'Active' : 'Idle'}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-lg p-3"
                style={{
                  background: 'linear-gradient(180deg, oklch(0.15 0.01 285 / 70%), oklch(0.12 0.01 285 / 70%))',
                  border: '1px solid oklch(0.27 0.012 285 / 32%)',
                }}
              >
                <PipelineConfig config={config} onConfigChange={setConfig} />
              </div>
            </div>

            {parseErrors.length > 0 && (
              <div
                className="rounded-lg px-3 py-2 flex-shrink-0"
                style={{
                  background: 'linear-gradient(180deg, oklch(0.6 0.25 25 / 8%), oklch(0.58 0.21 25 / 7%))',
                  border: '1px solid oklch(0.6 0.25 25 / 25%)',
                  animation: 'shake 0.3s ease',
                }}
              >
                {parseErrors.map((error, idx) => (
                  <p key={idx} className="text-[10px] font-mono" style={{ color: 'oklch(0.8 0.18 25)' }}>
                    Line {error.line}: {error.message}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Right: scrollable results panel */}
          <div
            className="h-full min-h-0 flex flex-col rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, oklch(0.13 0.008 220 / 76%), oklch(0.10 0.008 220 / 76%))',
              border: '1px solid oklch(0.27 0.012 220 / 30%)',
              backdropFilter: 'blur(8px)',
              animation: result ? 'slide-in-right 0.4s ease' : undefined,
            }}
          >
            {/* Results Header */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
              style={{
                borderBottom: '1px solid oklch(0.3 0.02 260 / 30%)',
                background: 'oklch(0.1 0.015 260 / 50%)',
              }}
            >
              <span className="text-sm">📋</span>
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: 'oklch(0.6 0.02 260)', fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Pipeline Results
              </span>
            </div>

            {/* Main highlight: larger animation window */}
            <div
              className="rounded-none border-b flex-shrink-0 overflow-hidden"
              style={{
                height: '44vh',
                minHeight: '300px',
                borderColor: 'oklch(0.27 0.012 220 / 32%)',
                background: 'linear-gradient(180deg, oklch(0.15 0.01 220 / 74%), oklch(0.12 0.01 220 / 74%))',
              }}
            >
              <PipelineTrack result={result} currentCycle={currentCycle} config={config} />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <div className="p-5 space-y-6">
                {/* Pipeline Table */}
                <div>
                  <h3
                    className="text-[10px] uppercase tracking-widest font-semibold mb-2"
                    style={{ color: 'oklch(0.5 0.02 260)', fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    Pipeline Execution Table
                  </h3>
                  <div
                    className="rounded-lg p-3"
                    style={{
                      background: 'linear-gradient(180deg, oklch(0.14 0.01 250 / 75%), oklch(0.12 0.01 250 / 75%))',
                      border: '1px solid oklch(0.26 0.015 250 / 35%)',
                    }}
                  >
                    <PipelineTable result={result} currentCycle={currentCycle} />
                  </div>
                </div>

                {/* Hazard Analysis */}
                <div>
                  <h3
                    className="text-[10px] uppercase tracking-widest font-semibold mb-2"
                    style={{ color: 'oklch(0.5 0.02 260)', fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    Hazard Analysis
                  </h3>
                  <div
                    className="rounded-lg p-3"
                    style={{
                      background: 'linear-gradient(180deg, oklch(0.14 0.01 250 / 75%), oklch(0.12 0.01 250 / 75%))',
                      border: '1px solid oklch(0.26 0.015 250 / 35%)',
                    }}
                  >
                    <HazardPanel
                      hazards={result?.hazards || []}
                      instructionRaws={instructionRaws}
                    />
                  </div>
                </div>

                <div>
                  <h3
                    className="text-[10px] uppercase tracking-widest font-semibold mb-2"
                    style={{ color: 'oklch(0.5 0.02 260)', fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    Register Vault
                  </h3>
                  <div
                    className="rounded-lg p-3"
                    style={{
                      background: 'linear-gradient(180deg, oklch(0.14 0.01 250 / 75%), oklch(0.12 0.01 250 / 75%))',
                      border: '1px solid oklch(0.26 0.015 250 / 35%)',
                    }}
                  >
                    <RegisterVault
                      result={result}
                      currentCycle={currentCycle}
                      pipelineType={config.pipelineType}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
