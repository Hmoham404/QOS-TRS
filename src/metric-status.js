const rejectLimits = {
  injection: [.01, .02],
  welding: [.01, .02],
  metallization: [.08, .10],
  assembly: [.015, .03],
  'screen-printing': [.015, .03],
};

// Bounds belong to the yellow interval; missing values have no status.
export function metricStatus(value, metric, department) {
  if (!Number.isFinite(value)) return 'neutral';
  if (metric === 'trs' || metric === 'dle') {
    return value > .95 ? 'green' : value >= .85 ? 'yellow' : 'red';
  }
  if (metric === 'rejects' && rejectLimits[department]) {
    const [low, high] = rejectLimits[department];
    return value > high ? 'red' : value >= low ? 'yellow' : 'green';
  }
  return 'neutral';
}
