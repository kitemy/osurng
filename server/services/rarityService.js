'use strict';
const { RARITIES, RARITY_THRESHOLDS, LUCK, getRarityOrder } = require('../../config/gameConfig');

/** Compute player rarity from osu! global rank and pp. Highest matching tier wins. */
function computeRarity({ global_rank, pp }) {
  const rank = (global_rank == null || global_rank <= 0) ? Infinity : Number(global_rank);
  const points = Number(pp) || 0;
  // Evaluate from highest rarity to lowest
  const ordered = [...RARITY_THRESHOLDS].sort((a, b) => getRarityOrder(b.id) - getRarityOrder(a.id));
  for (const t of ordered) {
    if (rank <= t.maxRank && points >= t.minPP) return t.id;
  }
  return 'common';
}

/**
 * Compute final luck.
 * finalLuck = baseLuck * (1 + permanentBonus) * temporaryMultiplier, capped.
 */
function computeFinalLuck({ permanentBonus = 0, temporaryMultiplier = 1 } = {}) {
  const base = LUCK.baseLuck;
  const raw = base * (1 + Number(permanentBonus || 0)) * Number(temporaryMultiplier || 1);
  return Math.min(LUCK.maxFinalLuck, Math.max(0.01, raw));
}

/**
 * Build normalized rarity probabilities influenced by luck.
 * - Start from base weights.
 * - Luck increases relative odds of higher rarities via order-based factor, never reducing higher tiers vs baseline proportion unfairly.
 * - Renormalize so total = 1.
 */
function getRarityProbabilities(finalLuck = 1) {
  const luck = Math.max(0.01, Number(finalLuck) || 1);
  const maxOrder = Math.max(...RARITIES.map(r => r.order));
  const adjusted = RARITIES.map(r => {
    const tier = maxOrder === 0 ? 0 : r.order / maxOrder; // 0 common .. 1 secret
    // Factor >= 1 for higher tiers when luck>1; common stays near 1; slight dampening for commons at high luck
    const factor = Math.pow(luck, tier * LUCK.rarityBiasExponent);
    const commonDampen = r.order === 0 ? Math.pow(luck, -0.15 * Math.min(luck, 5)) : 1;
    return { id: r.id, weight: r.weight * factor * commonDampen };
  });
  const total = adjusted.reduce((s, r) => s + r.weight, 0) || 1;
  return adjusted.map(r => ({ id: r.id, probability: r.weight / total }));
}

function rollRarity(finalLuck = 1, rng = Math.random) {
  const probs = getRarityProbabilities(finalLuck);
  let x = rng();
  for (const p of probs) {
    x -= p.probability;
    if (x <= 0) return p.id;
  }
  return probs[probs.length - 1].id;
}

module.exports = { computeRarity, computeFinalLuck, getRarityProbabilities, rollRarity };
