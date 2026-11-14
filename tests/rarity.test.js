'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeRarity, computeFinalLuck, getRarityProbabilities, rollRarity } = require('../server/services/rarityService');
const { RARITIES } = require('../config/gameConfig');

test('computeRarity maps rank/pp to expected tiers', () => {
  assert.equal(computeRarity({ global_rank: 1, pp: 14000 }), 'secret');
  assert.equal(computeRarity({ global_rank: 50, pp: 9500 }), 'mythic');
  assert.equal(computeRarity({ global_rank: 500, pp: 7500 }), 'legendary');
  assert.equal(computeRarity({ global_rank: 5000, pp: 5000 }), 'epic');
  assert.equal(computeRarity({ global_rank: 20000, pp: 3000 }), 'rare');
  assert.equal(computeRarity({ global_rank: 100000, pp: 1500 }), 'uncommon');
  assert.equal(computeRarity({ global_rank: 1000000, pp: 500 }), 'common');
  assert.equal(computeRarity({ global_rank: null, pp: 0 }), 'common');
});

test('computeFinalLuck applies formula and cap', () => {
  assert.equal(computeFinalLuck({ permanentBonus: 0, temporaryMultiplier: 1 }), 1);
  assert.equal(computeFinalLuck({ permanentBonus: 0.5, temporaryMultiplier: 2 }), 3);
  const capped = computeFinalLuck({ permanentBonus: 10, temporaryMultiplier: 10 });
  assert.ok(capped <= 10);
});

test('rarity probabilities normalize to 1 and luck favors higher tiers', () => {
  const base = getRarityProbabilities(1);
  const lucky = getRarityProbabilities(3);
  const sumBase = base.reduce((s, r) => s + r.probability, 0);
  const sumLucky = lucky.reduce((s, r) => s + r.probability, 0);
  assert.ok(Math.abs(sumBase - 1) < 1e-9);
  assert.ok(Math.abs(sumLucky - 1) < 1e-9);
  const byId = (arr, id) => arr.find(x => x.id === id).probability;
  // higher tiers should not decrease in absolute chance under strong luck? they should increase relative and typically absolute vs low-tier mass shift; ensure secret/mythic increase
  assert.ok(byId(lucky, 'secret') > byId(base, 'secret'));
  assert.ok(byId(lucky, 'mythic') > byId(base, 'mythic'));
  assert.ok(byId(lucky, 'legendary') > byId(base, 'legendary'));
});

test('rollRarity returns a valid rarity id', () => {
  const ids = new Set(RARITIES.map(r => r.id));
  for (let i = 0; i < 50; i++) {
    const id = rollRarity(1 + i * 0.05);
    assert.ok(ids.has(id));
  }
  // deterministic RNG edges
  assert.equal(rollRarity(1, () => 0), RARITIES[0].id);
  assert.ok(ids.has(rollRarity(1, () => 0.999999)));
});
