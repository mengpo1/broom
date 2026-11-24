// Steering after the bench hands the car back (lot 5): the chain keyboard -> input layer ->
// Race.setPlayerInput -> car, followed step by step in the real game, in real time, with real key events.
// For each case of the collision bench: who feeds the controls of the player's car before and after
// the hand-over (the keyboard, the scripted driver of the bench, or both), and what the car does when
// the left and right keys are held. The same keys are then tried in a normal race, without the bench.
// node work/scripts/steering-handover-check.mjs [out.json]
import { writeFileSync } from 'node:fs';
import { openGame, root } from './lib-browser.mjs';

const out = process.argv[2] || `${root}/work/benchmarks/steering-handover.json`;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const waitFor = async (page, fn, arg, seconds = 90) => { try { await page.waitForFunction(fn, arg, { timeout: seconds * 1000, polling: 50 }); return true; } catch { return false; } };

/**
 * Follow every simulation step: who called setPlayerInput for player 1 (the input layer or the bench),
 * and the car afterwards. The bench builds a new race for each case: each one is followed from its first step.
 */
const instrument = (page) => page.evaluate(() => {
  const v = window.virage, app = v.app, lab = app.lab;
  window.__source = 'keyboard';
  const follow = (race) => {
    if (!race || race.__followed) return;
    race.__followed = true;
    const log = (window.__steps = []);
    let calls = [];
    const set = race.setPlayerInput.bind(race);
    race.setPlayerInput = (p, steer, throttle, brake, shift, boost, reset) => { if (p === 0) calls.push({ source: window.__source, steer, throttle }); return set(p, steer, throttle, brake, shift, boost, reset); };
    const step = race.step.bind(race);
    race.step = (dt) => {
      const car = race.playerCars[0], asked = { inSteer: car.inSteer, inThrottle: car.inThrottle };
      step(dt);
      log.push({ tick: race.tick, released: lab ? lab.released : true, keyboard: calls.filter((c) => c.source === 'keyboard').map((c) => c.steer), bench: calls.filter((c) => c.source === 'bench').map((c) => c.steer),
        left: v.input.keys.has('ArrowLeft'), right: v.input.keys.has('ArrowRight'), inSteer: asked.inSteer, inThrottle: asked.inThrottle, steer: car.steer, yaw: car.yawRate, heading: car.heading, speed: car.speed, state: car.state,
        pitAuto: car.pitAuto, autoDrive: car.autoDrive, kick: v.debug.hopSteerKick(car) });
      calls = [];
    };
  };
  if (lab && !lab.__followed) {
    lab.__followed = true;
    const before = lab.beforeStep.bind(lab);
    lab.beforeStep = () => { window.__source = 'bench'; before(); window.__source = 'keyboard'; };
    const start = lab.start.bind(lab);
    // (the start of a case runs the first seconds of its race by itself: followed only once the cars are placed)
    lab.start = (...args) => { const ok = start(...args); follow(app.race); return ok; };
  }
  follow(app.race);
});
const steps = (page, from = 0) => page.evaluate((f) => window.__steps.slice(f), from);
const count = (page) => page.evaluate(() => window.__steps.length);
const DEG = 180 / Math.PI;
const turned = (a, b) => (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * DEG;

/** Hold a key for `ms` of real time and return the steps simulated meanwhile. */
async function holdKey(page, key, ms) {
  const from = await count(page);
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  const got = await steps(page, from);
  await page.keyboard.up(key);
  return got;
}
function summary(rows, sign) {
  // (the first step may have been simulated between the two calls of the script: it is left out)
  const held = rows.filter((r) => (sign < 0 ? r.left : r.right));
  if (held.length < 3) return { steps: held.length };
  const first = held[0], last = held[held.length - 1];
  return { steps: held.length, seconds: +(held.length / 120).toFixed(2), keyboardRequests: [...new Set(held.flatMap((r) => r.keyboard))], benchRequests: held.reduce((n, r) => n + r.bench.length, 0),
    requestSeenByTheCar: [...new Set(held.map((r) => r.inSteer))], steerAtTheEnd: +last.steer.toFixed(3), fullLockAfterSeconds: (() => { const i = held.findIndex((r) => Math.abs(r.steer) >= 0.999); return i < 0 ? null : +((i + 1) / 120).toFixed(3); })(),
    yawDegPerSecondAtTheEnd: +(last.yaw * DEG).toFixed(1), headingTurnedDeg: +turned(first.heading, last.heading).toFixed(1), speedKmh: [+(first.speed * 3.6).toFixed(0), +(last.speed * 3.6).toFixed(0)], states: [...new Set(held.map((r) => r.state))] };
}

const report = { note: 'real game, real time, real key events; nothing is changed', cases: {} };

{
  const { page, logs, close } = await openGame({ width: 960, height: 540, hash: 'lab=hop&quality=medium' });
  await instrument(page);
  for (const [key, name] of [['Digit2', 'hop'], ['Digit1', 'wheel'], ['Digit5', 'bump'], ['Digit6', 'body'], ['Digit7', 'under'], ['Digit3', 'crash'], ['Digit4', 'board']]) {
    await page.keyboard.press(key);
    if ((await page.evaluate(() => window.virage.app.lab.name)) !== name) { console.log(`     (${name}: this build has no such case)`); continue; }
    const entry = (report.cases[name] = {});
    // ---- before the hand-over: the left key is held; the bench still drives
    // (held until twenty steps have been simulated with it, however long the first picture of a new circuit takes)
    await page.keyboard.down('ArrowLeft');
    await waitFor(page, () => window.__steps.filter((r) => r.left).length >= 20 || window.virage.app.lab.released, null, 30);
    const early = await steps(page);
    await page.keyboard.up('ArrowLeft');
    const before = early.filter((r) => !r.released && r.left);
    entry.beforeTheHandOver = { stepsWithTheLeftKeyHeld: before.length, keyboardRequests: [...new Set(before.flatMap((r) => r.keyboard))], stepsFedByTheBench: before.filter((r) => r.bench.length === 1).length,
      requestSeenByTheCar: [Math.min(...before.map((r) => r.inSteer)), Math.max(...before.map((r) => r.inSteer))].map((x) => +x.toFixed(3)) };
    check(`${name}: before the hand-over the keyboard is read (-1) but the bench has the last word on every step`, before.length > 5 && before.every((r) => r.keyboard.length === 1 && r.keyboard[0] === -1 && r.bench.length === 1 && r.inSteer === r.bench[0]),
      `${before.length} steps, request seen by the car ${entry.beforeTheHandOver.requestSeenByTheCar.join(' .. ')}`);
    const released = await waitFor(page, () => window.virage.app.lab.released, null, 120);
    const at = await count(page);
    const all = await steps(page);
    const firstReleased = all.findIndex((r) => r.released);
    entry.handOver = { afterSeconds: +((firstReleased < 0 ? all.length : firstReleased) / 120).toFixed(2), state: all[all.length - 1].state, speedKmh: +(all[all.length - 1].speed * 3.6).toFixed(0) };
    check(`${name}: the car is handed back`, released, `after ${entry.handOver.afterSeconds} s, at ${entry.handOver.speedKmh} km/h`);
    // ---- hands off for a moment: nothing feeds the car but the keyboard, which asks for nothing
    await page.waitForTimeout(250);
    const idle = (await steps(page, at)).filter((r) => r.released);
    entry.handsOff = { steps: idle.length, stepsFedByTheBench: idle.filter((r) => r.bench.length).length, requests: [...new Set(idle.map((r) => `${r.inSteer}/${r.inThrottle}`))], pitAuto: idle.some((r) => r.pitAuto), autoDrive: idle.some((r) => r.autoDrive) };
    check(`${name}: after the hand-over the bench no longer feeds the controls, and no automatic driver holds the car`, idle.length > 3 && idle.every((r) => r.bench.length === 0 && r.keyboard.length === 1 && !r.pitAuto && !r.autoDrive && r.inSteer === 0 && r.inThrottle === 0),
      `${idle.length} steps, requests ${entry.handsOff.requests.join(' ')}`);
    // ---- the keys: throttle held (so that a stopped car moves), left, then right, then both
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(name === 'crash' || name === 'board' ? 2500 : 300);
    const L = summary(await holdKey(page, 'ArrowLeft', 900), -1);
    await page.waitForTimeout(250);
    const R = summary(await holdKey(page, 'ArrowRight', 900), 1);
    await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowRight');
    const from = await count(page);
    await page.waitForTimeout(250);
    const both = (await steps(page, from)).filter((r) => r.left && r.right);
    await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp');
    entry.leftKey = L; entry.rightKey = R; entry.bothKeys = { steps: both.length, requestSeenByTheCar: [...new Set(both.map((r) => r.inSteer))] };
    check(`${name}: left key -> request -1 on every step, from the keyboard alone`, L.steps > 10 && L.keyboardRequests.length === 1 && L.keyboardRequests[0] === -1 && L.benchRequests === 0 && L.requestSeenByTheCar.length === 1 && L.requestSeenByTheCar[0] === -1, JSON.stringify(L));
    check(`${name}: right key -> request +1 on every step, from the keyboard alone`, R.steps > 10 && R.keyboardRequests.length === 1 && R.keyboardRequests[0] === 1 && R.benchRequests === 0 && R.requestSeenByTheCar.length === 1 && R.requestSeenByTheCar[0] === 1, JSON.stringify(R));
    check(`${name}: the car turns left then right (steering position, yaw rate, heading)`, L.steerAtTheEnd < -0.6 && L.yawDegPerSecondAtTheEnd < -3 && L.headingTurnedDeg < -2 && R.steerAtTheEnd > 0.6 && R.yawDegPerSecondAtTheEnd > 3 && R.headingTurnedDeg > 2,
      `left: steer ${L.steerAtTheEnd}, ${L.yawDegPerSecondAtTheEnd} deg/s, ${L.headingTurnedDeg} deg in ${L.seconds} s at ${L.speedKmh.join('->')} km/h; right: steer ${R.steerAtTheEnd}, ${R.yawDegPerSecondAtTheEnd} deg/s, ${R.headingTurnedDeg} deg in ${R.seconds} s at ${R.speedKmh.join('->')} km/h`);
    check(`${name}: both keys together -> 0`, both.length > 3 && both.every((r) => r.inSteer === 0), `${both.length} steps`);
  }
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  check('no console error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await close();
}

// ---- a normal race, without the bench: the same keys
{
  const { page, close } = await openGame({ width: 960, height: 540, hash: 'quality=medium' });
  await page.evaluate(() => {
    const v = window.virage, race = v.quickRace({ circuit: 'kestrel-fields', opponents: 3, gridPosition: 3, autoDrive: false, rules: 'arcade', laps: 4, seed: 4 });
    let guard = 0;
    while ((race.phase !== 'racing' || race.time < 0.2) && guard++ < 6000) { race.step(1 / 120); race.eventCount = 0; }
  });
  await instrument(page);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(4000);                      // up to some speed on the grid straight
  const L = summary(await holdKey(page, 'ArrowLeft', 900), -1);
  await page.waitForTimeout(250);
  const R = summary(await holdKey(page, 'ArrowRight', 900), 1);
  await page.keyboard.up('ArrowUp');
  report.normalRace = { leftKey: L, rightKey: R };
  check('normal race: left key -> request -1, right key -> request +1, and the car turns', L.requestSeenByTheCar[0] === -1 && L.requestSeenByTheCar.length === 1 && R.requestSeenByTheCar[0] === 1 && R.requestSeenByTheCar.length === 1
    && L.steerAtTheEnd < -0.6 && L.headingTurnedDeg < -2 && R.steerAtTheEnd > 0.6 && R.headingTurnedDeg > 2,
    `left: steer ${L.steerAtTheEnd}, ${L.yawDegPerSecondAtTheEnd} deg/s, ${L.headingTurnedDeg} deg in ${L.seconds} s at ${L.speedKmh.join('->')} km/h; right: steer ${R.steerAtTheEnd}, ${R.yawDegPerSecondAtTheEnd} deg/s, ${R.headingTurnedDeg} deg in ${R.seconds} s at ${R.speedKmh.join('->')} km/h`);
  await close();
}
writeFileSync(out, JSON.stringify(report, null, 1));
console.log('->', out);
console.log(failed ? `${failed} check(s) FAILED` : 'HAND-OVER OK');
process.exit(failed ? 1 : 0);
