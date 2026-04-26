'use client';

import type { SimConfig, PipelineType } from '@/lib/types';

interface PipelineConfigProps {
  config: SimConfig;
  onConfigChange: (config: SimConfig) => void;
}

export function PipelineConfig({ config, onConfigChange }: PipelineConfigProps) {
  const handlePipelineTypeChange = (value: PipelineType) => {
    onConfigChange({ ...config, pipelineType: value });
  };

  const handleForwardingChange = () => {
    onConfigChange({ ...config, forwardingEnabled: !config.forwardingEnabled });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label
          className="text-[10px] uppercase tracking-widest font-semibold"
          style={{ color: 'oklch(0.52 0.02 260)', fontFamily: 'var(--font-outfit), sans-serif' }}
        >
          Pipeline Configuration
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['4-stage', '5-stage'] as PipelineType[]).map((type) => {
            const active = config.pipelineType === type;
            return (
              <button
                key={type}
                id={`toggle-${type}`}
                onClick={() => handlePipelineTypeChange(type)}
                className="rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-300"
                style={{
                  background: active
                    ? 'linear-gradient(135deg, oklch(0.72 0.16 196 / 35%), oklch(0.62 0.18 290 / 30%))'
                    : 'oklch(0.13 0.02 260 / 85%)',
                  color: active ? 'oklch(0.94 0.01 260)' : 'oklch(0.58 0.02 260)',
                  border: `1px solid ${active ? 'oklch(0.72 0.16 196 / 40%)' : 'oklch(0.3 0.02 260 / 50%)'}`,
                }}
              >
                {type === '4-stage' ? '4 Stage' : '5 Stage'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="text-[10px] uppercase tracking-widest font-semibold"
          style={{ color: 'oklch(0.52 0.02 260)', fontFamily: 'var(--font-outfit), sans-serif' }}
        >
          Forwarding Unit
        </label>
        <button
          id="toggle-forwarding"
          onClick={handleForwardingChange}
          className="w-full rounded-lg px-3 py-2 flex items-center justify-between transition-all duration-300"
          style={{
            background: 'oklch(0.12 0.02 260 / 90%)',
            border: `1px solid ${config.forwardingEnabled ? 'oklch(0.7 0.2 155 / 45%)' : 'oklch(0.3 0.02 260 / 50%)'}`,
          }}
        >
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: config.forwardingEnabled ? 'oklch(0.8 0.15 155)' : 'oklch(0.56 0.02 260)' }}
          >
            {config.forwardingEnabled ? 'Forwarding Enabled' : 'Forwarding Disabled'}
          </span>
          <div
            className="relative w-12 h-6 rounded-full"
            style={{
              background: config.forwardingEnabled ? 'oklch(0.52 0.18 155)' : 'oklch(0.26 0.02 260)',
            }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-300"
              style={{
                transform: config.forwardingEnabled ? 'translateX(26px)' : 'translateX(2px)',
                background: 'oklch(0.95 0.01 260)',
                boxShadow: config.forwardingEnabled ? '0 0 10px oklch(0.7 0.2 155 / 45%)' : 'none',
              }}
            />
          </div>
        </button>
      </div>
    </div>
  );
}
