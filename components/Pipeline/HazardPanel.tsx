'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Hazard } from '@/lib/types';

interface HazardPanelProps {
  hazards: Hazard[];
  instructionRaws: Map<number, string>;
}

export function HazardPanel({ hazards, instructionRaws }: HazardPanelProps) {
  if (hazards.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">Hazard Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hazards detected — all instructions are independent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground">Hazard Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hazards.map((hazard, idx) => {
          const producerLabel = `I${hazard.producerIndex + 1}`;
          const consumerLabel = `I${hazard.consumerIndex + 1}`;
          const producerRaw = instructionRaws.get(hazard.producerIndex) || '';
          const consumerRaw = instructionRaws.get(hazard.consumerIndex) || '';

          return (
            <div key={idx} className="text-sm space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={hazard.resolvedByForwarding ? 'secondary' : 'destructive'}
                  className={hazard.resolvedByForwarding ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}
                >
                  RAW Hazard
                </Badge>
                <span className="text-muted-foreground">
                  {consumerLabel} depends on {producerLabel} via{' '}
                  <span className="font-mono text-primary font-bold">{hazard.register}</span>
                </span>
              </div>
              <div className="text-xs text-muted-foreground pl-2 font-mono">
                {producerLabel}: {producerRaw} → {consumerLabel}: {consumerRaw}
              </div>
              <div className="text-xs pl-2">
                {hazard.resolvedByForwarding ? (
                  <span className="text-green-400">
                    Resolved by forwarding — 0 stalls needed
                  </span>
                ) : (
                  <span className="text-red-400">
                    {hazard.stallsInserted} stall{hazard.stallsInserted !== 1 ? 's' : ''} inserted
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
