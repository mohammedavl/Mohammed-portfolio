import assert from 'node:assert/strict';
import {
  SCENARIOS, LAB_SLUGS, startGame, createInitialState, resetGame, chooseOption,
  nextIncident, showHint, validateScenarios, maxPossibleScore, discoveredSlugs,
  loadBestScore, saveBestScore,
} from '../artifacts/devops-lab/src/game/engine.ts';
import { readFile } from 'node:fs/promises';

assert.deepEqual(validateScenarios(), []);
const registry = await readFile(new URL('../artifacts/devops-lab/src/labs/registry.ts', import.meta.url), 'utf8');
const realSlugs = [...registry.matchAll(/^\s+slug: '([a-z0-9-]+)',/gm)].map(m => m[1]).sort();
assert.deepEqual([...LAB_SLUGS].sort(), realSlugs);
let s = startGame();
assert.equal(nextIncident(s), s);
assert.equal(chooseOption(s, 'not-a-choice'), s);
for (const incident of SCENARIOS) {
  const best = incident.choices.find(c => c.quality === 'best');
  const answered = chooseOption(s, best.id);
  assert.equal(chooseOption(answered, best.id), answered);
  s = nextIncident(answered);
}
assert.equal(s.status, 'won');
assert.equal(s.score, maxPossibleScore());
assert.equal(s.health, 100);
assert.equal(discoveredSlugs(s).length, 15);
assert.deepEqual(resetGame(), createInitialState());
s = showHint(startGame());
assert.equal(showHint(s), s);
s = chooseOption(s, SCENARIOS[0].choices.find(c => c.quality === 'best').id);
assert.equal(s.score, 75);
assert.equal(nextIncident(s).hintShown, false);
s = startGame();
for (let i = 0; i < 3; i++) {
  s = nextIncident(chooseOption(s, SCENARIOS[i].choices.find(c => c.quality === 'harmful').id));
}
assert.equal(s.status, 'lost');
assert.equal(s.health, 0);
const brokenStorage = {getItem() {throw Error('denied');}, setItem() {throw Error('denied');}};
assert.equal(loadBestScore(brokenStorage), 0);
assert.doesNotThrow(() => saveBestScore(100, brokenStorage));
let value = '100';
const storage = {getItem: () => value, setItem: (_, v) => {value = v;}};
assert.equal(saveBestScore(50, storage), 100);
assert.equal(saveBestScore(200, storage), 200);
assert.equal(value, '200');
console.log('Game checks passed: win, loss, reset, hints, duplicate scoring, storage, and all 15 project links.');
