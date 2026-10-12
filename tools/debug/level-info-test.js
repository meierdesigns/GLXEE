// Test function to ensure level info panel is visible
function testLevelInfoPanel() {
    
    const panel = document.getElementById('gameInfoPanel');
    if (!panel) {
        console.error('Game info panel not found in DOM!');
        return false;
    }
    
    
    // Force show the panel
    panel.style.display = 'block';
    panel.style.visibility = 'visible';
    panel.style.opacity = '1';
    panel.style.zIndex = '9999';
    
    return true;
}

// Auto-run test when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(testLevelInfoPanel, 100);
});

// Also run test immediately if DOM is already ready
if (document.readyState !== 'loading') {
    setTimeout(testLevelInfoPanel, 100);
}
