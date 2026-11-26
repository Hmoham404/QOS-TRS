import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metricStatus } from '../src/metric-status.js';

test('OEE et DLE : seuils identiques pour les cinq ateliers, bornes jaunes', () => {
  for (const department of ['injection', 'welding', 'metallization', 'assembly', 'screen-printing']) {
    for (const metric of ['trs', 'dle']) {
      for (const [value, status] of [[0, 'red'], [.8499, 'red'], [.85, 'yellow'], [.95, 'yellow'], [.9501, 'green'], [1.2, 'green'], [null, 'neutral'], [NaN, 'neutral']]) {
        assert.equal(metricStatus(value, metric, department), status);
      }
    }
  }
});

test('Rebut : limites propres aux ateliers, zéro vert et absence neutre', () => {
  for (const [department, low, high] of [['injection', .01, .02], ['welding', .01, .02], ['metallization', .08, .10], ['assembly', .015, .03], ['screen-printing', .015, .03]]) {
    for (const [value, status] of [[0, 'green'], [low - .0001, 'green'], [low, 'yellow'], [high, 'yellow'], [high + .0001, 'red'], [null, 'neutral']]) {
      assert.equal(metricStatus(value, 'rejects', department), status);
    }
  }
});
