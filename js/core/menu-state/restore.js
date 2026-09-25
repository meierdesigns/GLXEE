"use strict";

// MenuStateManager methods, split from menu-state.js.
extendClass(MenuStateManager, {
    /**
     * Restore UI after boot. Returns true if a non-default menu was opened.
     */
    restore() {
        const s = this.state;
        if (!s || !s.screen || s.screen === 'ingame' || s.screen === 'start') {
            if (s && s.screen === 'ingame') {
                this.setScreen('start');
            }
            return false;
        }

        switch (s.screen) {
            case 'planet-viewer':
                if (this.restoreViewer(
                    typeof planetViewerUI !== 'undefined' ? planetViewerUI : null,
                    { planetId: s.planet || 'mars' },
                    'planets'
                )) return true;
                break;
            case 'enemy-viewer':
                if (this.restoreViewer(
                    typeof enemyViewerUI !== 'undefined' ? enemyViewerUI : null,
                    { enemyType: s.enemyType || 'enemyBasic' },
                    'enemies'
                )) return true;
                break;
            case 'planet-editor':
                if (typeof planetEditorUI !== 'undefined') {
                    if (typeof startScreenManager !== 'undefined') {
                        startScreenManager.show({ skipPersist: true });
                    }
                    planetEditorUI.returnTo = s.returnTo || null;
                    planetEditorUI.show(s.planet || 'mars', s.tab || 'background', true);
                    return true;
                }
                break;
            case 'enemy-editor':
                if (typeof enemyEditorUI !== 'undefined') {
                    if (typeof startScreenManager !== 'undefined') {
                        startScreenManager.show({ skipPersist: true });
                    }
                    enemyEditorUI.returnTo = s.returnTo || null;
                    enemyEditorUI.show(s.enemyType || 'enemyBasic', s.tab || 'stats', true);
                    return true;
                }
                break;
            case 'ship-viewer':
                if (this.restoreViewer(
                    typeof shipViewerUI !== 'undefined' ? shipViewerUI : null,
                    { shipId: s.shipId || 'player' },
                    'ships'
                )) return true;
                break;
            case 'ship-editor':
                if (typeof shipEditorUI !== 'undefined') {
                    if (typeof startScreenManager !== 'undefined') {
                        startScreenManager.show({ skipPersist: true });
                    }
                    shipEditorUI.returnTo = s.returnTo || null;
                    shipEditorUI.show(s.shipId || 'player', s.tab || 'stats', true);
                    return true;
                }
                break;
            case 'ability-viewer':
                if (this.restoreViewer(
                    typeof abilityViewerUI !== 'undefined' ? abilityViewerUI : null,
                    { abilityId: s.abilityId || 'player_control' },
                    'abilities'
                )) return true;
                break;
            case 'weapon-viewer':
                if (this.restoreViewer(
                    typeof weaponViewerUI !== 'undefined' ? weaponViewerUI : null,
                    { weaponId: s.weaponId || 'laser' },
                    'weapons'
                )) return true;
                break;
            case 'defense-viewer':
                if (this.restoreViewer(
                    typeof defenseViewerUI !== 'undefined' ? defenseViewerUI : null,
                    { defenseId: s.defenseId || 'heavy_armor' },
                    'defenses'
                )) return true;
                break;
            case 'explosion-viewer':
                if (this.restoreViewer(
                    typeof explosionViewerUI !== 'undefined' ? explosionViewerUI : null,
                    { explosionId: s.explosionId || 'default' },
                    null
                )) return true;
                break;
            case 'faction-viewer':
                if (this.restoreViewer(
                    typeof factionViewerUI !== 'undefined' ? factionViewerUI : null,
                    { factionId: s.factionId || 'terran' },
                    'factions'
                )) return true;
                break;
            case 'event-viewer':
                if (this.restoreViewer(
                    typeof eventViewerUI !== 'undefined' ? eventViewerUI : null,
                    { eventId: s.eventId || 'repair' },
                    'events'
                )) return true;
                break;
            case 'ability-editor':
                if (typeof abilityEditorUI !== 'undefined') {
                    if (typeof startScreenManager !== 'undefined') {
                        startScreenManager.show({ skipPersist: true });
                    }
                    abilityEditorUI.returnTo = s.returnTo || null;
                    abilityEditorUI.show(s.abilityId || 'player_control', true);
                    return true;
                }
                break;
            case 'settings':
                if (typeof startScreenManager !== 'undefined') {
                    startScreenManager.showSettings = true;
                    startScreenManager.showCredits = false;
                    if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()
                        && typeof homeStationUI !== 'undefined') {
                        this.hideStartShell();
                        homeStationUI.show({
                            skipPersist: true,
                            tab: s.tab || 'station',
                            shopCategory: s.shopCategory || 'ships'
                        });
                        startScreenManager.show({
                            asOverlay: true,
                            showSettings: true,
                            skipPersist: true
                        });
                    } else {
                        startScreenManager.show({ skipPersist: true, forceMenu: true });
                    }
                    return true;
                }
                break;
            case 'theme-editor':
                if (typeof themeEditorUI !== 'undefined') {
                    this.hideStartShell();
                    themeEditorUI.show({
                        paletteId: s.palette || null,
                        returnToSettings: true,
                        skipPersist: true
                    });
                    return true;
                }
                break;
            case 'asset-gen':
                if (typeof assetGenUI !== 'undefined') {
                    if (typeof startScreenManager !== 'undefined') {
                        if (s.returnToSettings !== false) {
                            startScreenManager.showSettings = true;
                            startScreenManager.showCredits = false;
                        }
                        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()
                            && typeof homeStationUI !== 'undefined') {
                            this.hideStartShell();
                            homeStationUI.show({ skipPersist: true });
                        } else {
                            startScreenManager.show({ skipPersist: true, forceMenu: true });
                        }
                    }
                    assetGenUI.show({
                        typeId: s.typeId === 'factionShip' ? 'faction' : (s.typeId || 'mount'),
                        selectedId: s.selectedId || null,
                        mainTab: s.mainTab || 'library',
                        returnToSettings: s.returnToSettings !== false,
                        factionCategory: s.factionCategory || null,
                        skipPersist: true
                    });
                    return true;
                }
                break;
            case 'credits':
                if (typeof startScreenManager !== 'undefined') {
                    startScreenManager.showCredits = true;
                    startScreenManager.showSettings = false;
                    if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()
                        && typeof homeStationUI !== 'undefined') {
                        this.hideStartShell();
                        homeStationUI.show({
                            skipPersist: true,
                            tab: s.tab || 'station',
                            shopCategory: s.shopCategory || 'ships'
                        });
                        startScreenManager.show({
                            asOverlay: true,
                            showCredits: true,
                            skipPersist: true
                        });
                    } else {
                        startScreenManager.show({ skipPersist: true, forceMenu: true });
                    }
                    return true;
                }
                break;
            case 'home-station':
                if (typeof homeStationUI !== 'undefined') {
                    this.hideStartShell();
                    homeStationUI.show({
                        skipPersist: true,
                        tab: s.tab || 'station',
                        shopCategory: s.shopCategory || 'ships',
                        shopFilter: s.shopFilter,
                        shopSort: s.shopSort,
                        shopResourceQty: s.shopResourceQty,
                        componentType: s.componentType || null,
                        componentId: s.componentId || null,
                        onClose: () => {
                            if (typeof startScreenManager !== 'undefined') {
                                startScreenManager.returnToHub();
                            }
                        }
                    });
                    return true;
                }
                break;
            case 'galaxyMap':
            case 'combined':
                // Map lives in Home Station PLAY tab — never restore the old fullscreen modal.
                if (typeof homeStationUI !== 'undefined') {
                    this.hideStartShell();
                    this.setScreen('home-station', { tab: 'play' });
                    homeStationUI.show({
                        skipPersist: true,
                        tab: 'play',
                        onClose: () => {
                            if (typeof startScreenManager !== 'undefined') {
                                startScreenManager.returnToHub();
                            }
                        }
                    });
                    return true;
                }
                break;
            case 'onboarding':
                if (typeof onboardingManager !== 'undefined') {
                    this.hideStartShell();
                    onboardingManager.show({
                        onComplete: () => {
                            if (typeof startScreenManager !== 'undefined') {
                                startScreenManager.returnToHub();
                            }
                        }
                    });
                    return true;
                }
                break;
            case 'ships':
                if (typeof playerSelectionManager !== 'undefined') {
                    this.hideStartShell();
                    playerSelectionManager.show();
                    return true;
                }
                break;
            case 'planets':
                if (typeof planetSelectionManager !== 'undefined') {
                    this.hideStartShell();
                    planetSelectionManager.show();
                    return true;
                }
                break;
            default:
                break;
        }
        return false;
    },
});
