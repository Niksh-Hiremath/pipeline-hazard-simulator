'use client';

import { Download, Minus, Plus, Rocket, Save } from 'lucide-react';
import type { Instruction } from '@/lib/types';

interface InstructionSpriteProps {
  instruction: Instruction;
  isStalled: boolean;
  isForwarded: boolean;
  isCompleted: boolean;
  isVisible: boolean;
}

const opcodeConfig: Record<
  string,
  { icon: 'plus' | 'minus' | 'load' | 'save'; bgColor: string; borderColor: string; tint: string }
> = {
  ADD: {
    icon: 'plus',
    bgColor: 'oklch(0.63 0.22 305 / 18%)',
    borderColor: 'oklch(0.64 0.22 305 / 65%)',
    tint: 'oklch(0.85 0.15 305)',
  },
  SUB: {
    icon: 'minus',
    bgColor: 'oklch(0.63 0.22 305 / 18%)',
    borderColor: 'oklch(0.64 0.22 305 / 65%)',
    tint: 'oklch(0.85 0.15 305)',
  },
  LW: {
    icon: 'load',
    bgColor: 'oklch(0.72 0.18 205 / 16%)',
    borderColor: 'oklch(0.72 0.18 205 / 60%)',
    tint: 'oklch(0.88 0.11 205)',
  },
  SW: {
    icon: 'save',
    bgColor: 'oklch(0.72 0.18 205 / 16%)',
    borderColor: 'oklch(0.72 0.18 205 / 60%)',
    tint: 'oklch(0.88 0.11 205)',
  },
};

export function InstructionSprite({
  instruction,
  isStalled,
  isForwarded,
  isCompleted,
  isVisible,
}: InstructionSpriteProps) {
  const config = opcodeConfig[instruction.opcode] || opcodeConfig.ADD;
  const label = `I${instruction.index + 1}`;

  if (!isVisible) return null;

  return (
    <div
      className={`
        relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg
        font-mono text-xs select-none
        transition-all duration-300 ease-out
        ${isStalled ? 'sprite-card stalled' : isForwarded ? 'sprite-card forwarded' : 'sprite-card'}
        ${isCompleted ? 'opacity-40' : 'opacity-100'}
      `}
      style={{
        background: isStalled
          ? 'oklch(0.6 0.25 25 / 15%)'
          : isForwarded
            ? 'oklch(0.7 0.2 155 / 15%)'
            : config.bgColor,
        border: `1px solid ${isStalled ? 'oklch(0.6 0.25 25 / 60%)' : isForwarded ? 'oklch(0.7 0.2 155 / 60%)' : config.borderColor}`,
        boxShadow: isStalled
          ? '0 0 12px oklch(0.6 0.25 25 / 30%)'
          : isForwarded
            ? '0 0 12px oklch(0.7 0.2 155 / 30%)'
            : `0 0 12px ${config.borderColor}`,
        minWidth: '128px',
        maxWidth: '100%',
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: 'oklch(0.13 0.02 260 / 80%)',
          border: `1px solid ${config.borderColor}`,
        }}
      >
        {config.icon === 'plus' && <Plus className="w-4 h-4" style={{ color: config.tint }} />}
        {config.icon === 'minus' && <Minus className="w-4 h-4" style={{ color: config.tint }} />}
        {config.icon === 'load' && <Download className="w-4 h-4" style={{ color: config.tint }} />}
        {config.icon === 'save' && <Save className="w-4 h-4" style={{ color: config.tint }} />}
      </div>

      <div className="flex flex-col min-w-0 leading-tight">
        <span
          className="font-bold text-[10px]"
          style={{
            color: isStalled ? 'oklch(0.8 0.15 25)' : isForwarded ? 'oklch(0.8 0.15 155)' : 'oklch(0.95 0.01 260)',
          }}
        >
          {label} / {instruction.opcode}
        </span>
        <span className="text-[9px] truncate uppercase tracking-wide" style={{ color: 'oklch(0.58 0.02 260)' }}>
          {isStalled ? 'DATA WAIT' : instruction.opcode}
        </span>
      </div>

      {isStalled && (
        <div
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{
            background: 'oklch(0.6 0.25 25)',
            animation: 'pulse-glow 0.8s ease-in-out infinite',
          }}
        />
      )}

      {isForwarded && (
        <Rocket className="w-3.5 h-3.5 ml-auto" style={{ color: 'oklch(0.7 0.2 155)' }} />
      )}
    </div>
  );
}
