import React from 'react';
import { formatNumber } from './domain.js';

export default function ChartPointValue({ x, y, value, index, count, color = '#254b60', seriesIndex = 0 }) {
  if (value == null || !Number.isFinite(Number(value)) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const offset = [-18, 26, -40, 45][seriesIndex % 4];
  return <text className="chart-point-value" x={x} y={y + offset}
    textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
    fill={color} stroke="#fff" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke"
    fontSize="18" fontWeight="800" pointerEvents="none">
    {formatNumber(Number(value), 1)} %
  </text>;
}
