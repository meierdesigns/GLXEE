"use strict";

// Auto-open browser when files change
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

let isBrowserOpen = false;

function openBrowser() {
    if (!isBrowserOpen) {
        exec('Start-Process "index.html"', (error) => {
            if (!error) {
                isBrowserOpen = true;
                console.log('Browser opened automatically');
            }
        });
    }
}

function watchFiles() {
    const filesToWatch = [
        'index.html',
        'styles.css',
        'game.js',
        'core.js',
        'player.js',
        'bullets.js',
        'enemies.js',
        'obstacles.js',
        'collisions.js',
        'render.js',
        'graphics.js',
        'parallax.js',
        'sounds.js',
        'planet-selection.js'
    ];

    filesToWatch.forEach(file => {
        if (fs.existsSync(file)) {
            fs.watchFile(file, (curr, prev) => {
                if (curr.mtime !== prev.mtime) {
                    console.log(`${file} changed, opening browser...`);
                    setTimeout(openBrowser, 500); // Small delay to ensure file is saved
                }
            });
        }
    });
}

// Start watching files
watchFiles();
console.log('Auto-open enabled. Browser will open when files change.');
