
import React from 'react';
import { GyroData } from '../types';

interface GyroVisualizerProps {
  data: GyroData;
}

export const GyroVisualizer: React.FC<GyroVisualizerProps> = ({ data }) => {
  const normalize = (val: number | null) => {
    if (val === null) return 50;
    // Map -90 to 90 into 0 to 100
    const clamped = Math.max(-90, Math.min(90, val));
    return ((clamped + 90) / 180) * 100;
  };

  return (
    <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 w-full max-w-xs space-y-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Device Sensors</span>
        <i className="fas fa-microchip text-blue-500 animate-pulse"></i>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span>TILT (X)</span>
            <span>{data.beta?.toFixed(1) ?? '0.0'}°</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-100" 
              style={{ width: `${normalize(data.beta)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span>ROLL (Y)</span>
            <span>{data.gamma?.toFixed(1) ?? '0.0'}°</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-100" 
              style={{ width: `${normalize(data.gamma)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span>YAW (Z)</span>
            <span>{data.alpha?.toFixed(1) ?? '0.0'}°</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 transition-all duration-100" 
              style={{ width: `${(normalize(data.alpha ?? 0 / 4))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
