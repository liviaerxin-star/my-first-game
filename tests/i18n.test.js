import test from 'node:test';
import assert from 'node:assert/strict';

import { LEFT, MOVE_TYPES, RIGHT } from '../src/game/math-duel/constants.js';
import { createI18n, DEFAULT_LANGUAGE } from '../src/game/i18n.js';

test('i18n defaults to english and formats shared labels', () => {
  const i18n = createI18n();

  assert.equal(i18n.language, DEFAULT_LANGUAGE);
  assert.equal(i18n.playerLabel(LEFT), 'Blue');
  assert.equal(i18n.playerLabel(RIGHT), 'Red');
  assert.equal(i18n.moveTypeLabel(MOVE_TYPES.CHAIN_CROSS), 'Chain Cross');
  assert.equal(i18n.nodeLabel(null), 'Plain Point');
  assert.equal(i18n.nodeLabel(6), 'Point 6');
  assert.equal(i18n.t('metric.movesValue', { count: 3 }), '3 moves');
});

test('i18n switches to french and chinese for dynamic text', () => {
  const fr = createI18n('fr');
  const zh = createI18n('zh');

  assert.equal(fr.playerLabel(LEFT), 'Bleu');
  assert.equal(fr.moveTypeLabel(MOVE_TYPES.HOP), 'Saut');
  assert.equal(fr.t('status.preview', { moveType: 'Saut', execute: 'Jouer ce coup' }), 'Aperçu de Saut. Cliquez sur « Jouer ce coup » pour confirmer.');

  assert.equal(zh.playerLabel(RIGHT), '红方');
  assert.equal(zh.moveTypeLabel(MOVE_TYPES.SINGLE_CROSS), '单跨');
  assert.equal(zh.t('selection.currentSpot', { spot: zh.nodeLabel(8) }), '当前所在位号 8');
});
