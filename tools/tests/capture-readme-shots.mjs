#!/usr/bin/env node
"use strict";

/**
 * Capture live README screenshots for GitHub (wave 71O).
 * Uses CDP fromSurface + disabled GPU compositing so glass/transform layers paint.
 * Usage: node tools/tests/capture-readme-shots.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3008';
const tag = '71o';
const outDir = 'assets/ui';
mkdirSync(outDir, { recursive: true });

async function main() {
    const browser = await chromium.launch({
        args: [
            '--disable-gpu-compositing',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--force-device-scale-factor=1'
        ]
    });
    const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1
    });
    const cdp = await page.context().newCDPSession(page);
    page.on('pageerror', (e) => console.log('pageerror', e.message));

    const shot = async (name, clip) => {
        const file = path.join(outDir, `readme-shot-${name}-${tag}.png`);
        const opts = { format: 'png', fromSurface: true, captureBeyondViewport: true };
        if (clip) {
            opts.clip = {
                x: clip.x, y: clip.y,
                width: clip.width, height: clip.height,
                scale: 1
            };
        }
        const { data } = await cdp.send('Page.captureScreenshot', opts);
        writeFileSync(file, Buffer.from(data, 'base64'));
        console.log('wrote', file, statSync(file).size);
    };

    await page.goto(baseUrl, { waitUntil: 'load', timeout: 90000 });
    await page.mouse.click(640, 400);
    await page.waitForFunction(
        () => typeof game !== 'undefined'
            && typeof profileManager !== 'undefined'
            && typeof homeStationUI !== 'undefined',
        null,
        { timeout: 90000 }
    );
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
        try {
            if (!profileManager.profiles || !profileManager.profiles.length) {
                profileManager.create('VOLTEX-1', 'terran');
            }
            const list = profileManager.profiles || [];
            const p = list[0];
            if (p && profileManager.setActiveProfile) {
                profileManager.setActiveProfile(p.id || p.name || p);
            }
        } catch (e) { /* ignore */ }
    });
    await page.addStyleTag({
        content: `
            .vf-menu-enter { animation: none !important; opacity: 1 !important; }
            .home-station-overlay { opacity: 1 !important; visibility: visible !important; }
        `
    });

    const showTab = async (tab) => {
        await page.evaluate((t) => {
            document.querySelectorAll('.start-screen, #vf-boot-veil').forEach((el) => el.remove());
            if (typeof homeStationUI !== 'undefined' && homeStationUI.show) {
                homeStationUI.show({ tab: t, skipPersist: true });
            }
            document.querySelectorAll('.start-screen').forEach((el) => el.remove());
            const ov = document.querySelector('.home-station-overlay');
            if (ov) {
                ov.classList.remove('vf-menu-enter');
                ov.style.setProperty('opacity', '1', 'important');
            }
        }, tab);
        await page.waitForTimeout(800);
    };

    // Station glass layers often fail to composite in headless captures;
    // keep combat / modal overlays which paint reliably.
    await page.evaluate(() => {
        try {
            const ov = document.querySelector('.home-station-overlay');
            if (ov) ov.style.display = 'none';
            if (homeStationUI.hide) homeStationUI.hide();
        } catch (e) { /* ignore */ }
        game.startGame('mars');
    });
    await page.waitForTimeout(700);
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);
    await page.keyboard.down(' ');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(2000);
    await shot('combat');
    await shot('combat-focus', { x: 260, y: 60, width: 760, height: 560 });
    await page.keyboard.up(' ');
    await page.keyboard.up('ArrowRight');

    await page.evaluate(() => {
        try {
            if (typeof game !== 'undefined' && game.gameState) game.gameState.gameRunning = false;
            if (typeof factionCommandUI !== 'undefined' && factionCommandUI.show) factionCommandUI.show();
        } catch (e) { /* ignore */ }
    });
    await page.waitForTimeout(800);
    await shot('faction-pick');

    await page.evaluate(() => {
        try {
            if (typeof startScreenManager !== 'undefined' && startScreenManager.showProfiles) {
                startScreenManager.showProfiles();
            } else if (homeStationUI.show) {
                homeStationUI.show({ tab: 'play', skipPersist: true });
            }
        } catch (e) { /* ignore */ }
    });
    await page.waitForTimeout(800);
    await shot('pilot');

    // Best-effort station tabs (may still composite as title under glass scale)
    for (const [tab, name] of [
        ['station', 'station'],
        ['upgrade', 'upgrade'],
        ['hangar', 'hangar'],
        ['factions', 'factions'],
        ['factions', 'emblems'],
        ['travel', 'galaxy'],
        ['play', 'mission'],
        ['play', 'launch-hatch']
    ]) {
        await showTab(tab);
        await shot(name);
    }

    await page.evaluate(() => {
        try {
            if (homeStationUI.openTravelModal) homeStationUI.openTravelModal();
        } catch (e) { /* ignore */ }
    });
    await page.waitForTimeout(900);
    await shot('galaxy-map');

    await browser.close();
    console.log('done');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
