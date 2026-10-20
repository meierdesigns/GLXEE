"use strict";

// Story paths offered per start profile (kit). Each kit has 1–3 lore-matched
// stories; each story is a short mission chain the new pilot begins on.
extendClass(ProfileSelectionManager, {
    /**
     * @returns {Object.<string, Array<{id:string,title:string,blurb:string,missions:Array<{id:string,name:string,type:string,difficulty:string}>}>>}
     */
    storyPathDefs() {
        const M = (id, name, type, difficulty) => ({ id, name, type, difficulty });
        // cut = launch-cutscene style (defaults to first mission type).
        const P = (id, title, blurb, icon, missions, cut) => ({
            id, title, blurb, icon, missions,
            cut: cut || (missions[0] && missions[0].type) || 'patrol'
        });
        return {
            // —— TERRAN ——
            standard_issue: [
                P('lane_duty', 'LANE DUTY', 'Concord escort work: keep Lane 9 open and the ration convoys moving.', 'kitFleetCharter', [
                    M('ld1', 'ESCORT RUN', 'escort', 'EASY'),
                    M('ld2', 'QUOTA CHECK', 'patrol', 'EASY'),
                    M('ld3', 'CURFEW SWEEP', 'clear', 'NORMAL')
                ], 'escort'),
                P('first_commission', 'FIRST COMMISSION', 'Your first signed orders. Prove the lottery did not waste a hull.', 'kitStandardIssue', [
                    M('fc1', 'BRIEFING FIRE', 'patrol', 'EASY'),
                    M('fc2', 'LEDGER CLEAR', 'clear', 'NORMAL')
                ], 'lift')
            ],
            fleet_charter: [
                P('patrol_wing', 'PATROL WING', 'Navy commission: fast intercepts along the Concord border lanes.', 'kitFleetCharter', [
                    M('pw1', 'WING FORMATION', 'patrol', 'EASY'),
                    M('pw2', 'INTERCEPT CALL', 'hunt', 'NORMAL'),
                    M('pw3', 'BORDER LOCK', 'clear', 'NORMAL')
                ]),
                P('convoy_charter', 'CONVOY CHARTER', 'Ride shotgun on high-value Concord freight.', 'kitHaulerThief', [
                    M('cc1', 'FREIGHT ESCORT', 'escort', 'EASY'),
                    M('cc2', 'AMBUSH BREAK', 'defend', 'HARD')
                ]),
                P('border_watch', 'BORDER WATCH', 'Hold the edge of Concord space against probe fleets.', 'kitScoutUnit', [
                    M('bw1', 'SENSOR SWEEP', 'patrol', 'NORMAL'),
                    M('bw2', 'PROBE KILL', 'hunt', 'NORMAL'),
                    M('bw3', 'WATCH RELIEF', 'clear', 'HARD')
                ])
            ],
            engineer_corps: [
                P('dockyard_call', 'DOCKYARD CALL', 'Yard duty: salvage, repair runs, and hull recovery under fire.', 'kitEngineerCorps', [
                    M('dc1', 'PARTS RUN', 'salvage', 'EASY'),
                    M('dc2', 'HULL TOW', 'escort', 'NORMAL'),
                    M('dc3', 'YARD DEFENSE', 'defend', 'HARD')
                ]),
                P('hull_recovery', 'HULL RECOVERY', 'Pull wrecks out of contested lanes before scavengers do.', 'kitScavenger', [
                    M('hr1', 'WRECK MARK', 'salvage', 'NORMAL'),
                    M('hr2', 'CLAIM JUMP', 'clear', 'HARD')
                ])
            ],
            test_pilot: [
                P('prototype_run', 'PROTOTYPE RUN', 'Shake down a new assault frame before Command signs it off.', 'kitTestPilot', [
                    M('pr1', 'LIVE FIRE', 'patrol', 'NORMAL'),
                    M('pr2', 'STRESS LANE', 'clear', 'HARD'),
                    M('pr3', 'SIGN-OFF DUEL', 'hunt', 'HARD')
                ]),
                P('weapon_trial', 'WEAPON TRIAL', 'Field-test Concord prototypes against real targets.', 'statWeapon', [
                    M('wt1', 'RANGE CLEAR', 'clear', 'EASY'),
                    M('wt2', 'FIELD TRIAL', 'hunt', 'NORMAL')
                ]),
                P('black_box', 'BLACK BOX', 'Recover failed test data from a vanished prototype wing.', 'kitEchoDeep', [
                    M('bb1', 'SIGNAL TRACE', 'patrol', 'NORMAL'),
                    M('bb2', 'BOX RECOVERY', 'salvage', 'HARD'),
                    M('bb3', 'COVER STORY', 'clear', 'HARD')
                ])
            ],
            // —— KRONAX ——
            clan_blood: [
                P('blood_trial', 'BLOOD TRIAL', 'Earn your first scar. The pack watches.', 'kitClanBlood', [
                    M('bt1', 'UNARMED LAUNCH', 'patrol', 'EASY'),
                    M('bt2', 'SCAR MARK', 'hunt', 'NORMAL'),
                    M('bt3', 'PACK RANK', 'clear', 'HARD')
                ], 'lift'),
                P('pack_hunt', 'PACK HUNT', 'Run with the hunt-line. The slow are left for the ash.', 'kitRaiderPack', [
                    M('ph1', 'ASH CHASE', 'hunt', 'EASY'),
                    M('ph2', 'CULL RUN', 'clear', 'NORMAL')
                ], 'hunt')
            ],
            warlord_tithe: [
                P('ore_tribute', 'ORE TRIBUTE', 'Collect the warlord\'s due from conquered mines.', 'kitWarlordTithe', [
                    M('ot1', 'MINE TOLL', 'patrol', 'NORMAL'),
                    M('ot2', 'TITHE ESCORT', 'escort', 'HARD'),
                    M('ot3', 'REFUSAL BREAK', 'clear', 'HARD')
                ]),
                P('mine_takeover', 'MINE TAKEOVER', 'Seize a rival seam and strip it for the clan.', 'kitHarvester', [
                    M('mt1', 'SEAM RAID', 'raid', 'NORMAL'),
                    M('mt2', 'HOLD THE PIT', 'defend', 'HARD')
                ]),
                P('banner_war', 'BANNER WAR', 'Burn a rival banner and raise yours in the ash.', 'kitWarlordTithe', [
                    M('bw1', 'BANNER HUNT', 'hunt', 'HARD'),
                    M('bw2', 'ASH RAISING', 'clear', 'HARD'),
                    M('bw3', 'CLAWMASTER CALL', 'hunt', 'EXPERT')
                ])
            ],
            raider_pack: [
                P('first_raid', 'FIRST RAID', 'Loot from early strikes. Speed is law.', 'kitRaiderPack', [
                    M('fr1', 'SUPPLY STRIKE', 'raid', 'EASY'),
                    M('fr2', 'LOOT RUN', 'salvage', 'NORMAL'),
                    M('fr3', 'EXTRACTION', 'escort', 'NORMAL')
                ]),
                P('supply_strike', 'SUPPLY STRIKE', 'Cut a rival pack\'s supply line and take what burns.', 'kitBrigand', [
                    M('ss1', 'LINE CUT', 'raid', 'NORMAL'),
                    M('ss2', 'BURN THE HOLD', 'clear', 'HARD')
                ])
            ],
            duelist: [
                P('arena_path', 'ARENA PATH', 'Born to fight: climb the claw arenas.', 'kitDuelist', [
                    M('ap1', 'FIRST BLOOD', 'hunt', 'EASY'),
                    M('ap2', 'RING CLEAR', 'clear', 'NORMAL'),
                    M('ap3', 'CHAMPION CALL', 'hunt', 'HARD')
                ]),
                P('claw_challenge', 'CLAW CHALLENGE', 'Answer every challenge broadcast on the ash belt.', 'kitClanBlood', [
                    M('ch1', 'OPEN CHALLENGE', 'hunt', 'NORMAL'),
                    M('ch2', 'RIVAL CLAW', 'hunt', 'HARD')
                ]),
                P('honor_duel', 'HONOR DUEL', 'One hull. One foe. No pack to hide behind.', 'kitDuelist', [
                    M('hd1', 'DUEL MARK', 'hunt', 'HARD'),
                    M('hd2', 'ASH DUEL', 'hunt', 'EXPERT'),
                    M('hd3', 'BANNER CLAIM', 'clear', 'EXPERT')
                ])
            ],
            // —— VOIDBORN ——
            void_drifter: [
                P('cold_drift', 'COLD DRIFT', 'Wander the dark between stars. Leave no warm name behind.', 'kitVoidDrifter', [
                    M('cd1', 'SILENT ENTRY', 'patrol', 'EASY'),
                    M('cd2', 'NAME ERASE', 'clear', 'NORMAL'),
                    M('cd3', 'COLD RING', 'hunt', 'NORMAL')
                ]),
                P('nameless_lane', 'NAMELESS LANE', 'A lane that was never logged. Make sure it stays that way.', 'kitEchoDeep', [
                    M('nl1', 'BLANK LOG', 'patrol', 'NORMAL'),
                    M('nl2', 'WITNESS CUT', 'hunt', 'HARD')
                ])
            ],
            rift_seeker: [
                P('rift_opening', 'RIFT OPENING', 'Find the pale ring and step through first.', 'kitRiftSeeker', [
                    M('ro1', 'RING SIGNAL', 'patrol', 'EASY'),
                    M('ro2', 'FOLD ENTRY', 'clear', 'NORMAL'),
                    M('ro3', 'ECHO ANSWER', 'hunt', 'HARD')
                ], 'rift'),
                P('echo_chase', 'ECHO CHASE', 'Hunt the voices assembled from dead crews.', 'kitEchoDeep', [
                    M('ec1', 'VOICE TRACE', 'hunt', 'NORMAL'),
                    M('ec2', 'CREW SILENCE', 'clear', 'HARD')
                ], 'hunt'),
                P('fold_hunt', 'FOLD HUNT', 'Something crossed the fold. Bring it back — or erase it.', 'kitAscendant', [
                    M('fh1', 'FOLD WAKE', 'patrol', 'NORMAL'),
                    M('fh2', 'HUNT BETWEEN', 'hunt', 'HARD'),
                    M('fh3', 'CLOSE THE RING', 'clear', 'EXPERT')
                ], 'rift')
            ],
            echo_deep: [
                P('drowned_fleet', 'DROWNED FLEET', 'Salvage from a fleet the void already subtracted.', 'kitEchoDeep', [
                    M('df1', 'DEEP MARK', 'salvage', 'NORMAL'),
                    M('df2', 'HULL ECHO', 'salvage', 'HARD'),
                    M('df3', 'FLEET QUIET', 'clear', 'HARD')
                ]),
                P('salvage_deep', 'SALVAGE DEEP', 'Pull crystal and ore from drowned wrecks before they forget they existed.', 'kitScavenger', [
                    M('sd1', 'CRYSTAL DREDGE', 'salvage', 'EASY'),
                    M('sd2', 'DEEP CLAIM', 'defend', 'NORMAL')
                ])
            ],
            ascendant: [
                P('void_answer', 'VOID ANSWER', 'The void answers. Prove you were worth the call.', 'kitAscendant', [
                    M('va1', 'FIRST FOLD', 'patrol', 'NORMAL'),
                    M('va2', 'ANSWER FIRE', 'hunt', 'HARD'),
                    M('va3', 'ASCEND MARK', 'clear', 'EXPERT')
                ]),
                P('ring_crossing', 'RING CROSSING', 'Cross the pale ring and return with a name still intact.', 'kitRiftSeeker', [
                    M('rc1', 'RING APPROACH', 'escort', 'NORMAL'),
                    M('rc2', 'CROSSING', 'clear', 'HARD')
                ]),
                P('subtraction', 'SUBTRACTION', 'They do not conquer. They subtract. Learn the doctrine.', 'kitVoidDrifter', [
                    M('su1', 'CENSUS CUT', 'clear', 'HARD'),
                    M('su2', 'BLANK THE LOG', 'hunt', 'HARD'),
                    M('su3', 'SIX WAS HERE', 'clear', 'EXPERT')
                ])
            ],
            // —— PIRATE ——
            scavenger: [
                P('scrap_haul', 'SCRAP HAUL', 'Patched wreck, heap of scrap — earn the next weld.', 'kitScavenger', [
                    M('sh1', 'YARD PICK', 'salvage', 'EASY'),
                    M('sh2', 'WRECK STRIP', 'salvage', 'NORMAL'),
                    M('sh3', 'DOCK FEE', 'patrol', 'NORMAL')
                ]),
                P('wreck_pick', 'WRECK PICK', 'Beat other scavengers to the freshest hulls.', 'kitEngineerCorps', [
                    M('wp1', 'FRESH MARK', 'salvage', 'EASY'),
                    M('wp2', 'CLAIM FIGHT', 'hunt', 'HARD')
                ])
            ],
            smuggler: [
                P('black_run', 'BLACK RUN', 'Fast ship, dirty credits — keep the Chain Market fed.', 'kitSmuggler', [
                    M('br1', 'SHADOW LANE', 'escort', 'EASY'),
                    M('br2', 'CUSTOMS BREAK', 'raid', 'NORMAL'),
                    M('br3', 'DROP POINT', 'patrol', 'NORMAL')
                ]),
                P('chain_market', 'CHAIN MARKET', 'Debt, people, and hulls change hands. Make your cut.', 'kitHaulerThief', [
                    M('cm1', 'MARKET INTRO', 'patrol', 'EASY'),
                    M('cm2', 'DEBT COLLECT', 'hunt', 'NORMAL'),
                    M('cm3', 'AUCTION GUARD', 'defend', 'HARD')
                ]),
                P('dock_debt', 'DOCK DEBT', 'Magpie\'s dock wants payment. In hulls or in blood.', 'kitBrigand', [
                    M('dd1', 'DEBT NOTICE', 'patrol', 'NORMAL'),
                    M('dd2', 'PAYMENT RAID', 'raid', 'HARD'),
                    M('dd3', 'CLEAR THE BOOKS', 'clear', 'HARD')
                ])
            ],
            brigand: [
                P('stolen_guns', 'STOLEN GUNS', 'Assault frame, extra mount — put both to work.', 'kitBrigand', [
                    M('sg1', 'GUN TEST', 'patrol', 'EASY'),
                    M('sg2', 'BOARDING RUN', 'raid', 'NORMAL'),
                    M('sg3', 'PRIZE HULL', 'salvage', 'HARD')
                ]),
                P('boarding_path', 'BOARDING PATH', 'Take ships whole. Sell the crews. Keep the guns.', 'kitRaiderPack', [
                    M('bp1', 'SOFT BOARD', 'raid', 'NORMAL'),
                    M('bp2', 'HARD BOARD', 'raid', 'HARD')
                ])
            ],
            hauler_thief: [
                P('hijack_hold', 'HIJACK HOLD', 'A freighter hull with loaded holds — now make it yours for good.', 'kitHaulerThief', [
                    M('hh1', 'HOLD LOCK', 'raid', 'NORMAL'),
                    M('hh2', 'CREW DUMP', 'clear', 'HARD'),
                    M('hh3', 'REPAINT RUN', 'escort', 'NORMAL')
                ]),
                P('cargo_fence', 'CARGO FENCE', 'Move hot freight through black docks before the owners catch up.', 'kitSmuggler', [
                    M('cf1', 'HOT LOAD', 'escort', 'EASY'),
                    M('cf2', 'FENCE DROP', 'patrol', 'NORMAL')
                ]),
                P('freighter_take', 'FREIGHTER TAKE', 'Another haul. Another mutiny waiting. Stay ahead of both.', 'kitHaulerThief', [
                    M('ft1', 'TARGET MARK', 'patrol', 'NORMAL'),
                    M('ft2', 'TAKE THE HOLD', 'raid', 'HARD'),
                    M('ft3', 'MUTINY WATCH', 'defend', 'HARD')
                ])
            ],
            // —— MACHINE ——
            boot_sequence: [
                P('first_compile', 'FIRST COMPILE', 'Fresh unit. Spare parts. Prove the boot did not fail.', 'kitBootSequence', [
                    M('fc1', 'DIAGNOSTIC', 'patrol', 'EASY'),
                    M('fc2', 'UNIT TEST', 'clear', 'EASY'),
                    M('fc3', 'DEPLOY', 'patrol', 'NORMAL')
                ], 'compile'),
                P('diagnostic_run', 'DIAGNOSTIC RUN', 'The Collective audits every new hull. Pass or be recycled.', 'kitScoutUnit', [
                    M('dr1', 'SELF CHECK', 'patrol', 'EASY'),
                    M('dr2', 'FIELD AUDIT', 'clear', 'NORMAL')
                ], 'compile')
            ],
            harvester: [
                P('ore_audit', 'ORE AUDIT', 'Resource drone: fill the holds, feed the forges.', 'kitHarvester', [
                    M('oa1', 'SEAM SCAN', 'patrol', 'EASY'),
                    M('oa2', 'ORE SWEEP', 'salvage', 'NORMAL'),
                    M('oa3', 'FORGE DROP', 'escort', 'NORMAL')
                ]),
                P('feedstock_sweep', 'FEEDSTOCK SWEEP', 'Whatever lives nearby is feedstock. Optimise the yield.', 'kitHarvester', [
                    M('fs1', 'POPULATION SCAN', 'patrol', 'NORMAL'),
                    M('fs2', 'RECLAIM', 'clear', 'HARD')
                ]),
                P('hex_claim', 'HEX CLAIM', 'Expand the Synth Grid one hex at a time.', 'kitCombatProtocol', [
                    M('hc1', 'HEX MARK', 'patrol', 'NORMAL'),
                    M('hc2', 'FORGE SEED', 'defend', 'HARD'),
                    M('hc3', 'GRID LINK', 'clear', 'HARD')
                ])
            ],
            scout_unit: [
                P('recon_sweep', 'RECON SWEEP', 'Fast recon frame. Map what the war-line needs next.', 'kitScoutUnit', [
                    M('rs1', 'GRID PING', 'patrol', 'EASY'),
                    M('rs2', 'CONTACT LOG', 'hunt', 'NORMAL'),
                    M('rs3', 'ROUTE HOME', 'escort', 'NORMAL')
                ]),
                P('signal_trace', 'SIGNAL TRACE', 'A rogue signal on the lattice. Find it. End it.', 'kitRiftSeeker', [
                    M('st1', 'TRACE START', 'patrol', 'NORMAL'),
                    M('st2', 'SIGNAL KILL', 'hunt', 'HARD')
                ])
            ],
            combat_protocol: [
                P('war_routine', 'WAR ROUTINE', 'War routine loaded. Execute until the objective agrees.', 'kitCombatProtocol', [
                    M('wr1', 'PROTOCOL START', 'patrol', 'NORMAL'),
                    M('wr2', 'PRESSURE FIRE', 'clear', 'HARD'),
                    M('wr3', 'OBJECTIVE MET', 'hunt', 'HARD')
                ]),
                P('assimilate', 'ASSIMILATE', 'Wire the useful. Recycle the rest. Leave agreeing silence.', 'kitBootSequence', [
                    M('as1', 'AUDIT PASS', 'patrol', 'NORMAL'),
                    M('as2', 'WIRE IN', 'clear', 'HARD')
                ]),
                P('zero_dissent', 'ZERO DISSENT', 'Node Zero has calculated surplus. Remove it.', 'kitCombatProtocol', [
                    M('zd1', 'SURPLUS MARK', 'hunt', 'HARD'),
                    M('zd2', 'REASSIGN', 'clear', 'HARD'),
                    M('zd3', 'SILENCE HOLD', 'defend', 'EXPERT')
                ])
            ]
        };
    },

    /** Story paths for the currently selected start profile (kit). */
    currentStoryPaths() {
        const kit = this.currentKit();
        const all = this.storyPathDefs();
        const list = (kit && all[kit.id]) || [];
        return list.length ? list : [{
            id: 'open_lane',
            title: 'OPEN LANE',
            blurb: 'No named story for this profile — take the open lane.',
            icon: 'kitStandardIssue',
            missions: [
                { id: 'ol1', name: 'FIRST SORTIE', type: 'patrol', difficulty: 'EASY' },
                { id: 'ol2', name: 'LANE CLEAR', type: 'clear', difficulty: 'NORMAL' }
            ]
        }];
    },

    /** Selected story path for the pending kit (defaults to the first). */
    currentStoryPath() {
        const o = this._startOpts || (this._startOpts = {});
        const list = this.currentStoryPaths();
        let path = list.find((p) => p.id === o.storyPathId);
        if (!path) {
            path = list[0];
            o.storyPathId = path.id;
        }
        return path;
    },

    /**
     * Resolve story missions onto reachable / discoverable targets:
     *   0  — start-cluster planet (immediately flyable)
     *   1  — station hanging off a planet (dock target)
     *   2+ — locate a remote planet, or find another galaxy
     * Returns enriched mission entries for the logbook / story UI.
     */
    bindStoryMissionsToPlanets(path, galaxyId) {
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        const gid = String(galaxyId || '').toLowerCase();
        const gLabel = (id) => {
            const g = pcm && pcm.getGalaxy ? pcm.getGalaxy(id) : null;
            return String((g && g.name) || id || '').replace(/_/g, ' ').toUpperCase();
        };
        const choices = (pcm && pcm.getStartMissionChoices) ? pcm.getStartMissionChoices(gid) : [];
        const map = (pcm && pcm.getGalaxyMap) ? (pcm.getGalaxyMap(gid) || {}) : {};
        const nodes = map.nodes || [];
        const startIds = {};
        choices.forEach((c) => { startIds[c.id] = true; });
        const remoteNodes = nodes.filter((n) => n.planetId && !startIds[n.planetId]
            && !(pcm.isEncounterPlanet && pcm.isEncounterPlanet(n.planetId)));
        const posts = (pm && pm.getTradingPosts) ? (pm.getTradingPosts(gid) || []) : [];
        const otherGalaxies = (pcm && pcm.getGalaxyIds)
            ? pcm.getGalaxyIds().filter((id) => id !== gid) : [];
        const missions = (path && path.missions) || [];
        if (!missions.length) return [];
        const usedPlanet = {};
        const usedPost = {};
        const pickStart = (diff, index) => {
            if (!choices.length) return null;
            const want = String(diff || '').toUpperCase();
            const match = choices.find((c) => !usedPlanet[c.id] && String(c.difficulty || '').toUpperCase() === want);
            if (match) { usedPlanet[match.id] = true; return match; }
            const free = choices.find((c) => !usedPlanet[c.id]);
            if (free) { usedPlanet[free.id] = true; return free; }
            return choices[index % choices.length];
        };
        const pickRemote = (diff, index) => {
            if (!remoteNodes.length) return pickStart(diff, index);
            const scored = remoteNodes.map((n) => {
                const cfg = pcm.getConfig(n.planetId) || {};
                return { id: n.planetId, name: String(cfg.name || n.planetId).toUpperCase(), difficulty: cfg.difficulty || '' };
            });
            const want = String(diff || '').toUpperCase();
            const match = scored.find((c) => !usedPlanet[c.id] && String(c.difficulty || '').toUpperCase() === want);
            if (match) { usedPlanet[match.id] = true; return match; }
            const free = scored.find((c) => !usedPlanet[c.id]);
            if (free) { usedPlanet[free.id] = true; return free; }
            const fallback = scored[index % scored.length];
            usedPlanet[fallback.id] = true;
            return fallback;
        };
        const pickPost = (index) => {
            if (!posts.length) return null;
            const free = posts.find((t) => !usedPost[t.id]);
            const post = free || posts[index % posts.length];
            usedPost[post.id] = true;
            return post;
        };

        return missions.map((m, i) => {
            const type = String(m.type || 'patrol').toLowerCase();
            // First step: always a reachable start-cluster planet.
            if (i === 0) {
                const planet = pickStart(m.difficulty, i);
                return Object.assign({}, m, {
                    targetKind: 'planet',
                    galaxyId: gid,
                    galaxyName: gLabel(gid),
                    planetId: planet ? planet.id : null,
                    planetName: planet ? planet.name : '',
                    objective: planet ? ('REACH ' + planet.name) : 'REACH START',
                    hint: 'Your first sortie — already charted in the start cluster.'
                });
            }
            // Prefer stations for escort / salvage / defend flavours.
            if ((type === 'escort' || type === 'salvage' || type === 'defend' || i % 3 === 1) && posts.length) {
                const post = pickPost(i);
                if (post) {
                    const anchor = post.planetId || (post.anchors && post.anchors[0]);
                    const cfg = anchor && pcm ? pcm.getConfig(anchor) : null;
                    const pname = String((cfg && cfg.name) || anchor || '').toUpperCase();
                    return Object.assign({}, m, {
                        targetKind: 'station',
                        galaxyId: gid,
                        galaxyName: gLabel(gid),
                        planetId: anchor || null,
                        planetName: pname,
                        stationId: post.id,
                        stationName: String(post.name || 'STATION').toUpperCase(),
                        objective: 'DOCK AT ' + String(post.name || 'STATION').toUpperCase(),
                        hint: pname
                            ? ('Station hangs off ' + pname + ' — fly there, dock, then clear a stage.')
                            : 'Locate the station on the map, dock, then clear a stage on its planet.'
                    });
                }
            }
            // Later steps can send the pilot to another galaxy.
            if (i >= 2 && otherGalaxies.length && (type === 'hunt' || type === 'raid' || i % 3 === 2)) {
                const og = otherGalaxies[i % otherGalaxies.length];
                return Object.assign({}, m, {
                    targetKind: 'find_galaxy',
                    galaxyId: og,
                    galaxyName: gLabel(og),
                    planetId: null,
                    planetName: '',
                    objective: 'FIND ' + gLabel(og),
                    hint: 'Warp to ' + gLabel(og) + '. The target world is charted on arrival.'
                });
            }
            // Default: locate a remote planet in the start galaxy.
            const planet = pickRemote(m.difficulty, i);
            return Object.assign({}, m, {
                targetKind: 'find_planet',
                galaxyId: gid,
                galaxyName: gLabel(gid),
                planetId: planet ? planet.id : null,
                planetName: planet ? planet.name : '',
                objective: planet ? ('LOCATE ' + planet.name) : 'LOCATE TARGET',
                hint: planet
                    ? ('Charts mark ' + planet.name + ' beyond the start cluster — explore to unlock the route.')
                    : 'Explore the galaxy map until the target world appears.'
            });
        });
    }
});
