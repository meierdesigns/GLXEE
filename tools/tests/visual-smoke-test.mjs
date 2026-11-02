#!/usr/bin/env node
// Visual + perf smoke test: launches the game, forces combat, holds "shoot",
// then checks the effects systems stay healthy (no unbounded growth, no stuck
// bullet cap, playable frame rate) and saves a screenshot for a human look.
//
// Usage: node tools/tests/visual-smoke-test.mjs [baseUrl]
// Requires: `npm run dev` already running (default http://localhost:3000),
// and `npx playwright install chromium` done once.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] || 'http://localhost:3000';
const outDir = 'tools/tests/out';
mkdirSync(outDir, { recursive: true });

const RUN_MS = 8000;
const SAMPLE_MS = 500;

async function main() {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 480, height: 600 } });

    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    console.log(`Loading ${baseUrl} ...`);
    await page.goto(baseUrl, { waitUntil: 'load' });
    // Playwright's synthetic keydown events are silently dropped by Chromium
    // until the page has an actual input focus/gesture — a plain click gives
    // it one. Without this, every keyboard.press/down below is a no-op and
    // the run looks "clean" only because nothing ever happened.
    await page.mouse.click(240, 300);

    // Jump straight into combat, bypassing menu navigation.
    await page.waitForFunction(() => typeof game !== 'undefined' && typeof game.startGame === 'function');
    await page.evaluate(() => game.startGame('mars'));
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${outDir}/01-combat-start.png` });

    // Combat starts on a "FIRE TO START" screen — one tap dismisses it.
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);

    // Hold "shoot" and strafe so bullets, explosions and hit effects actually fire.
    await page.keyboard.down(' ');
    await page.keyboard.down('ArrowLeft');

    const samples = [];
    const start = Date.now();
    while (Date.now() - start < RUN_MS) {
        await page.waitForTimeout(SAMPLE_MS);
        if ((Date.now() - start) % 2000 < SAMPLE_MS) {
            // brief direction flip so bullets/obstacles spread across the field
            await page.keyboard.up('ArrowLeft');
            await page.keyboard.down('ArrowRight');
        }
        const sample = await page.evaluate(() => {
            const bm = (typeof bulletManager !== 'undefined') ? bulletManager : null;
            const sm = (typeof soundManager !== 'undefined') ? soundManager : null;
            const ps = (typeof graphicsManager !== 'undefined' && graphicsManager.particleSystem)
                ? graphicsManager.particleSystem : null;
            return {
                t: performance.now(),
                bullets: bm ? bm.getBullets().length : null,
                enemyBullets: bm ? bm.getEnemyBullets().length : null,
                activeTimeouts: sm && sm.activeTimeouts ? sm.activeTimeouts.length : null,
                particles: ps && ps.particles ? ps.particles.length : null,
                gameRunning: (typeof game !== 'undefined' && game.gameState) ? game.gameState.gameRunning : null,
            };
        });
        samples.push(sample);
    }
    await page.keyboard.up(' ');
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowRight');

    await page.screenshot({ path: `${outDir}/02-combat-after-run.png` });

    // Rough FPS measurement over one second of real frames.
    const fps = await page.evaluate(() => new Promise((resolve) => {
        let frames = 0;
        const t0 = performance.now();
        function tick() {
            frames++;
            if (performance.now() - t0 < 1000) requestAnimationFrame(tick);
            else resolve(frames);
        }
        requestAnimationFrame(tick);
    }));

    await browser.close();

    console.log('\n--- Samples over time (bullets / enemyBullets / activeTimeouts / particles) ---');
    for (const s of samples) {
        console.log(`t+${Math.round(s.t)}ms  bullets=${s.bullets} enemyBullets=${s.enemyBullets} activeTimeouts=${s.activeTimeouts} particles=${s.particles}`);
    }
    console.log(`\nMeasured FPS: ${fps}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    for (const e of consoleErrors) console.log('  ' + e);
    console.log(`\nScreenshots: ${outDir}/01-combat-start.png, ${outDir}/02-combat-after-run.png`);

    // Pass/fail checks.
    const bulletCounts = samples.map((s) => s.bullets).filter((v) => v != null);
    const timeoutCounts = samples.map((s) => s.activeTimeouts).filter((v) => v != null);
    const maxBullets = Math.max(0, ...bulletCounts);
    const timeoutGrowth = timeoutCounts.length ? timeoutCounts[timeoutCounts.length - 1] - timeoutCounts[0] : 0;

    let ok = true;
    if (maxBullets >= 18) { console.log(`FAIL: bullet pool saturated (max=${maxBullets}, cap=18)`); ok = false; }
    if (timeoutGrowth > 20) { console.log(`FAIL: activeTimeouts grew by ${timeoutGrowth} over the run (expected it to stay roughly flat)`); ok = false; }
    if (fps < 20) { console.log(`FAIL: FPS too low (${fps})`); ok = false; }
    if (consoleErrors.length) { console.log(`FAIL: ${consoleErrors.length} console error(s) during the run`); ok = false; }

    if (ok) console.log('\nPASS: effects ran without saturating the bullet pool, leaking timeouts, dropping FPS, or throwing.');
    process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
