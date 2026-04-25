'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AssemblyEditor } from '@/components/Editor/AssemblyEditor';
import { PipelineConfig } from '@/components/Pipeline/PipelineConfig';
import { PipelineTable } from '@/components/Pipeline/PipelineTable';
import { HazardPanel } from '@/components/Pipeline/HazardPanel';
import { SimulationControls } from '@/components/Controls/SimulationControls';
import { parseInstructions } from '@/lib/parser';
import { simulate } from '@/lib/simulator';
import type { SimConfig, ParseError, SimulationResult } from '@/lib/types';

const DEFAULT_CODE = `# Example program
ADD R1, R2, R3
LW R4, 0(R1)
SUB R5, R4, R1`;

type SimState = 'idle' | 'running' | 'complete';

export default function Home() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [config, setConfig] = useState<SimConfig>({
    pipelineType: '5-stage',
    forwardingEnabled: false,
  });
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [simState, setSimState] = useState<SimState>('idle');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [, setCurrentCycle] = useState(0);

  const handleEditorChange = useCallback((value: string) => {
    setCode(value);
    const { errors } = parseInstructions(value);
    setParseErrors(errors);
    if (simState !== 'idle') {
      setSimState('idle');
      setResult(null);
      setCurrentCycle(0);
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
    setCurrentCycle(simResult.totalCycles);
    setSimState('complete');
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

  const handleReset = useCallback(() => {
    setSimState('idle');
    setResult(null);
    setCurrentCycle(0);
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Plaksha Orbital Pipeline Deck
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pipeline Hazard Simulator
              </p>
            </div>
            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
              MIPS Pipeline
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
          <div className="flex flex-col gap-4 min-h-0">
            <Card className="flex-1 min-h-0 flex flex-col bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">
                  Assembly Editor
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <div className="h-full">
                  <AssemblyEditor
                    value={code}
                    onChange={handleEditorChange}
                    onErrors={handleErrors}
                  />
                </div>
              </CardContent>
            </Card>

            {parseErrors.length > 0 && (
              <Card className="bg-destructive/10 border-destructive/30">
                <CardContent className="pt-4">
                  <div className="space-y-1">
                    {parseErrors.map((error, idx) => (
                      <p key={idx} className="text-xs text-destructive font-mono">
                        Line {error.line}: {error.message}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
            <PipelineConfig config={config} onConfigChange={setConfig} />

            <SimulationControls
              onRun={handleRun}
              onStep={handleStep}
              onReset={handleReset}
              hasErrors={hasErrors}
              isComplete={isComplete}
            />

            <Card className="flex-1 min-h-0 flex flex-col bg-card border-border overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">
                  Pipeline Table
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <PipelineTable result={result} />
                </ScrollArea>
              </CardContent>
            </Card>

            <HazardPanel
              hazards={result?.hazards || []}
              instructionRaws={instructionRaws}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
