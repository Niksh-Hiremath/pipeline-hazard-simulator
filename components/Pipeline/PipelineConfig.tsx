'use client';

import { Toggle } from '@/components/ui/toggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SimConfig, PipelineType } from '@/lib/types';

interface PipelineConfigProps {
  config: SimConfig;
  onConfigChange: (config: SimConfig) => void;
}

export function PipelineConfig({ config, onConfigChange }: PipelineConfigProps) {
  const handlePipelineTypeChange = (value: string) => {
    onConfigChange({
      ...config,
      pipelineType: value as PipelineType,
    });
  };

  const handleForwardingChange = (value: boolean) => {
    onConfigChange({
      ...config,
      forwardingEnabled: value,
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground">Pipeline Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Pipeline Type
          </label>
          <div className="flex gap-2">
            <Toggle
              pressed={config.pipelineType === '4-stage'}
              onPressedChange={() => handlePipelineTypeChange('4-stage')}
              className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              4-Stage
            </Toggle>
            <Toggle
              pressed={config.pipelineType === '5-stage'}
              onPressedChange={() => handlePipelineTypeChange('5-stage')}
              className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              5-Stage
            </Toggle>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Forwarding
          </label>
          <Toggle
            pressed={config.forwardingEnabled}
            onPressedChange={handleForwardingChange}
            className="w-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {config.forwardingEnabled ? 'Enabled' : 'Disabled'}
          </Toggle>
        </div>
      </CardContent>
    </Card>
  );
}
