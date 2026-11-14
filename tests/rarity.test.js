'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeRarity, computeFinalLuck, getRarityProbabilities, rollRarity } = require('../server/services/rarityService');
const { RARITIES } = require('../config/gameConfig');

test('computeRarity maps PP-only to expected tiers', () => {
  // thresholds: dimensional>=31000, transcendant>=26000, glorious>=22000, exalted>=18500,
  // legendary>=16500, mythic>=12500, epic>=10500, rare>=8200, uncommon>=4500, common otherwise
  assert.equal(computeRarity({ pp: 32000 }), 'dimensional');
  assert.equal(computeRarity({ pp: 27000 }), 'transcendant');
  assert.equal(computeRarity({ pp: 23000 }), 'glorious');
  assert.equal(computeRarity({ pp: 19000 }), 'exalted');
  assert.equal(computeRarity({ pp: 17000 }), 'legendary');
  assert.equal(computeRarity({ pp: 13000 }), 'mythic');
  assert.equal(computeRarity({ pp: 11000 }), 'epic');
  assert.equal(computeRarity({ pp: 9000 }), 'rare');
  assert.equal(computeRarity({ pp: 5000 }), 'uncommon');
  assert.equal(computeRarity({ pp: 1000 }), 'common');
  assert.equal(computeRarity({ pp: null }), 'common');
});

test('computeFinalLuck applies formula without cap', () => {
  assert.equal(computeFinalLuck({ permanentBonus: 0, temporaryMultiplier: 1 }), 1);
  assert.equal(computeFinalLuck({ permanentBonus: 0.5, temporaryMultiplier: 2 }), 3);
  const uncapped = computeFinalLuck({ permanentBonus: 10, temporaryMultiplier: 10 });
  assert.equal(uncapped, 110);
});

test('rarity probabilities normalize to 1 and luck favors higher tiers', () => {
  const base = getRarityProbabilities(1);
  const lucky = getRarityProbabilities(3);
  const sumBase = base.reduce((s, r) => s + r.probability, 0);
  const sumLucky = lucky.reduce((s, r) => s + r.probability, 0);
  assert.ok(Math.abs(sumBase - 1) < 1e-9);
  assert.ok(Math.abs(sumLucky - 1) < 1e-9);
  const byId = (arr, id) => arr.find(x => x.id === id).probability;
  // higher tiers should increase under strong luck
  assert.ok(byId(lucky, 'dimensional') > byId(base, 'dimensional'));
  assert.ok(byId(lucky, 'transcendant') > byId(base, 'transcendant'));
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
