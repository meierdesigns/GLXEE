"use strict";

// Launch-cutscene dialogue + plain-language story lines.
// Each story gets 3–4 spoken beats so the plot is readable before the home station.
const VFStoryDialogue = {
    _D(who, text) { return { who: String(who || 'VOICE'), text: String(text || '') }; },

    /** Plain synopsis used when a path has no authored blurb override. */
    synopsis: {
        lane_duty: 'Escort Concord ration convoys and keep Lane 9 open.',
        first_commission: 'Fly your first signed orders and prove the lottery did not waste a hull.',
        patrol_wing: 'Join a navy wing for fast intercepts along the Concord border.',
        convoy_charter: 'Ride shotgun on high-value Concord freight and break ambushes.',
        border_watch: 'Hold the edge of Concord space against probe fleets.',
        dockyard_call: 'Salvage parts, tow hulls, and defend the yard under fire.',
        hull_recovery: 'Pull wrecks out of contested lanes before scavengers claim them.',
        prototype_run: 'Shake down a new assault frame before Command signs it off.',
        weapon_trial: 'Field-test Concord prototype weapons against live targets.',
        black_box: 'Trace a vanished test wing and recover its black-box data.',
        blood_trial: 'Prove yourself to the Kronax pack: survive, kill, and earn your first scar.',
        pack_hunt: 'Run with the hunt-line and cull the slow across the ash belt.',
        ore_tribute: 'Collect the warlord\'s ore tithe from conquered mines.',
        mine_takeover: 'Seize a rival mine seam and hold it for the clan.',
        banner_war: 'Burn a rival banner and raise yours in the ash.',
        first_raid: 'Strike for loot on your first raid — speed is law.',
        supply_strike: 'Cut a rival pack\'s supply line and take what burns.',
        arena_path: 'Climb the claw arenas from first blood to champion call.',
        claw_challenge: 'Answer every challenge broadcast on the ash belt.',
        honor_duel: 'Fight alone: one hull, one foe, no pack to hide behind.',
        cold_drift: 'Wander the dark between stars and erase every warm name you leave.',
        nameless_lane: 'Keep an unlogged lane blank — no witnesses, no records.',
        rift_opening: 'Find the pale rift ring and be the first to step through.',
        echo_chase: 'Hunt voices assembled from dead crews and silence them.',
        fold_hunt: 'Track something that crossed the fold — recover it or erase it.',
        drowned_fleet: 'Salvage a fleet the void already subtracted.',
        salvage_deep: 'Pull crystal and ore from drowned wrecks before they vanish.',
        void_answer: 'Answer the void\'s call and prove you were worth contacting.',
        ring_crossing: 'Cross the pale ring and return with your name still intact.',
        subtraction: 'Learn Voidborn doctrine: they do not conquer — they subtract.',
        scrap_haul: 'Strip wrecks for scrap until you can afford the next weld.',
        wreck_pick: 'Beat other scavengers to the freshest hulls.',
        black_run: 'Smuggle dirty cargo for the Chain Market and dodge customs.',
        chain_market: 'Cut deals in debt, people, and hulls — take your percentage.',
        dock_debt: 'Pay Magpie\'s dock in hulls or blood before the books close.',
        stolen_guns: 'Put a stolen assault frame and extra mount to work.',
        boarding_path: 'Board ships whole, sell the crews, keep the guns.',
        hijack_hold: 'Steal a freighter\'s hold and make the hull yours for good.',
        cargo_fence: 'Move hot freight through black docks before the owners catch up.',
        freighter_take: 'Mark another freighter, take the hold, watch for mutiny.',
        first_compile: 'Boot as a fresh Machine unit and pass every diagnostic.',
        diagnostic_run: 'Survive the Collective audit — pass, or be recycled.',
        ore_audit: 'Scan seams, fill holds, and feed the forges.',
        feedstock_sweep: 'Reclaim nearby life as feedstock for the forges.',
        hex_claim: 'Expand the Synth Grid one hex at a time.',
        recon_sweep: 'Map contacts for the war-line and bring the route home.',
        signal_trace: 'Trace a rogue lattice signal and end it.',
        war_routine: 'Load war routine and fire until the objective agrees.',
        assimilate: 'Wire what is useful. Recycle the rest.',
        zero_dissent: 'Node Zero marked surplus life — remove it.',
        open_lane: 'No named story — take the open lane and clear your first sorties.'
    },

    /** Spoken beats keyed by story id. */
    lines: null,

    _build() {
        if (this.lines) return this.lines;
        const D = (who, text) => this._D(who, text);
        this.lines = {
            lane_duty: [
                D('COMMAND', 'Lane 9 is bleeding. Ration convoys will not wait.'),
                D('OPS', 'Your job: escort the freighters and keep the lane open.'),
                D('YOU', 'Copy. I will hold the route.'),
                D('COMMAND', 'Then launch. Concord is watching the ledger.')
            ],
            first_commission: [
                D('COMMAND', 'These are your first signed orders.'),
                D('OPS', 'The lottery gave you a hull. Prove it was not a waste.'),
                D('YOU', 'Briefing received. Starting the patrol.'),
                D('COMMAND', 'Come back with a clear lane — or do not come back.')
            ],
            patrol_wing: [
                D('WING LEAD', 'Welcome to the wing. We intercept fast and leave clean.'),
                D('OPS', 'Border probes are lighting the Concord edge.'),
                D('YOU', 'Forming up. Call the intercept.'),
                D('WING LEAD', 'Stay in formation until the border locks.')
            ],
            convoy_charter: [
                D('COMMAND', 'High-value freight. You ride shotgun.'),
                D('OPS', 'Expect an ambush on the second leg.'),
                D('YOU', 'Convoy is under my guns.'),
                D('COMMAND', 'Keep the holds intact. Credits follow survivors.')
            ],
            border_watch: [
                D('COMMAND', 'Probe fleets are testing the Concord edge.'),
                D('OPS', 'Sensor sweep first. Kill what answers.'),
                D('YOU', 'Watch post is mine.'),
                D('COMMAND', 'Hold until relief. No gaps.')
            ],
            dockyard_call: [
                D('YARD CHIEF', 'Yard needs parts, tows, and someone who can shoot.'),
                D('OPS', 'Salvage under fire. Then defend the dock.'),
                D('YOU', 'I will bring the hulls home.'),
                D('YARD CHIEF', 'Then get moving — the bay will not wait.')
            ],
            hull_recovery: [
                D('YARD CHIEF', 'Contested lanes are full of fresh wrecks.'),
                D('OPS', 'Mark them before scavengers strip the seams.'),
                D('YOU', 'Claim jumpers will lose.'),
                D('YARD CHIEF', 'Pull the hulls. We pay for tonnage.')
            ],
            prototype_run: [
                D('TEST LEAD', 'New assault frame. Live fire only.'),
                D('OPS', 'Stress the lane, then duel for sign-off.'),
                D('YOU', 'Frame is hot. Starting the run.'),
                D('TEST LEAD', 'Break it properly — or Command bins the design.')
            ],
            weapon_trial: [
                D('TEST LEAD', 'Prototype mounts. Real targets.'),
                D('OPS', 'Clear the range, then field-trial the loadout.'),
                D('YOU', 'Weapons armed. Seeking contact.'),
                D('TEST LEAD', 'Log every kill. Data first, glory second.')
            ],
            black_box: [
                D('COMMAND', 'A prototype wing vanished. We need the black boxes.'),
                D('OPS', 'Trace the signal. Recover the data. Cover the rest.'),
                D('YOU', 'I will find what they left behind.'),
                D('COMMAND', 'Do not become the next missing entry.')
            ],
            blood_trial: [
                D('PACK ELDER', 'New blood. The pack does not gift scars.'),
                D('PACK ELDER', 'Launch alone. Survive the ash. Mark a kill.'),
                D('YOU', 'I will not return empty.'),
                D('PACK ELDER', 'Earn the scar. We are watching.')
            ],
            pack_hunt: [
                D('CLAWMASTER', 'Hunt-line forms. The slow feed the ash.'),
                D('PACK', 'Chase. Cull. Leave no stragglers.'),
                D('YOU', 'I run with the pack.'),
                D('CLAWMASTER', 'Keep pace — or become the quarry.')
            ],
            ore_tribute: [
                D('WARLORD', 'The mines owe tithe. Collect it.'),
                D('OVERSEER', 'Toll the pits. Escort the ore. Break refusal.'),
                D('YOU', 'Their holds will open.'),
                D('WARLORD', 'Bring the due. Leave the excuses in the dust.')
            ],
            mine_takeover: [
                D('WARLORD', 'A rival seam sits soft. Take it.'),
                D('OVERSEER', 'Raid the pit. Hold what you seize.'),
                D('YOU', 'The mine will fly our banner.'),
                D('WARLORD', 'Strip it for the clan. No mercy for holdouts.')
            ],
            banner_war: [
                D('CLAWMASTER', 'A rival banner still stands. Burn it.'),
                D('PACK', 'Hunt the bearers. Raise our mark in the ash.'),
                D('YOU', 'Their colors die today.'),
                D('CLAWMASTER', 'When the ash settles, only ours remains.')
            ],
            first_raid: [
                D('RAID BOSS', 'First raid. Speed is law.'),
                D('CREW', 'Strike supply, grab loot, extract clean.'),
                D('YOU', 'I take what burns.'),
                D('RAID BOSS', 'Lag and you feed the next crew\'s scrap pile.')
            ],
            supply_strike: [
                D('RAID BOSS', 'Rival packs eat when their line holds.'),
                D('CREW', 'Cut the line. Burn the hold.'),
                D('YOU', 'Supply dies on my guns.'),
                D('RAID BOSS', 'Leave them hungry. Bring the salvage home.')
            ],
            arena_path: [
                D('ARENA MASTER', 'The claw arenas do not cheer soft pilots.'),
                D('CROWD', 'First blood. Ring clear. Champion call.'),
                D('YOU', 'I climb until nothing stands.'),
                D('ARENA MASTER', 'Then step into the ring and earn the noise.')
            ],
            claw_challenge: [
                D('ARENA MASTER', 'Challenges flood the ash belt.'),
                D('RIVAL', 'Answer — or admit you fear the claw.'),
                D('YOU', 'Every challenge gets my guns.'),
                D('ARENA MASTER', 'Broadcast your answer. Make them regret calling.')
            ],
            honor_duel: [
                D('CLAWMASTER', 'One hull. One foe. No pack behind you.'),
                D('RIVAL', 'Mark the duel. Meet in the ash.'),
                D('YOU', 'I need no shield but my aim.'),
                D('CLAWMASTER', 'Win, and the banner is yours. Fall, and you are ash.')
            ],
            cold_drift: [
                D('THE ECHO', 'Wander cold. Leave no warm name.'),
                D('RIFT VOICE', 'Enter silent. Erase the log. Close the ring.'),
                D('YOU', 'I drift where charts end.'),
                D('THE ECHO', 'The dark remembers only those who stay quiet.')
            ],
            nameless_lane: [
                D('THE ECHO', 'This lane was never logged. Keep it that way.'),
                D('RIFT VOICE', 'Blank the log. Cut the witnesses.'),
                D('YOU', 'No name survives this route.'),
                D('THE ECHO', 'Silence is the only cargo that matters.')
            ],
            rift_opening: [
                D('RIFT VOICE', 'The pale ring sings. Someone must enter first.'),
                D('THE ECHO', 'Follow the signal. Fold through. Answer what waits.'),
                D('YOU', 'I take the first step.'),
                D('RIFT VOICE', 'Do not look back until the ring closes behind you.')
            ],
            echo_chase: [
                D('THE ECHO', 'Dead crews still speak in assembled voices.'),
                D('RIFT VOICE', 'Trace them. End the chorus.'),
                D('YOU', 'I hunt the echo.'),
                D('THE ECHO', 'Silence is mercy — for them and for you.')
            ],
            fold_hunt: [
                D('RIFT VOICE', 'Something crossed the fold. It should not have.'),
                D('THE ECHO', 'Track the wake. Recover it — or erase it.'),
                D('YOU', 'I will close what they opened.'),
                D('RIFT VOICE', 'Bring proof. Or bring nothing, carefully.')
            ],
            drowned_fleet: [
                D('THE ECHO', 'A fleet already subtracted still holds salvage.'),
                D('RIFT VOICE', 'Mark the deep. Pull the hulls. Quiet the rest.'),
                D('YOU', 'I dredge what the void forgot.'),
                D('THE ECHO', 'Take crystal and ore. Leave the names drowned.')
            ],
            salvage_deep: [
                D('THE ECHO', 'Drowned wrecks still glitter with crystal.'),
                D('RIFT VOICE', 'Dredge fast. Defend the claim.'),
                D('YOU', 'The deep yields to my hooks.'),
                D('THE ECHO', 'Before they forget they existed — take them.')
            ],
            void_answer: [
                D('RIFT VOICE', 'The void answered. Prove you were worth the call.'),
                D('THE ECHO', 'First fold. Answer fire. Ascend mark.'),
                D('YOU', 'I answer.'),
                D('RIFT VOICE', 'Return changed — or do not return.')
            ],
            ring_crossing: [
                D('RIFT VOICE', 'Cross the pale ring. Keep your name intact.'),
                D('THE ECHO', 'Escort the approach. Survive the crossing.'),
                D('YOU', 'My name stays with me.'),
                D('RIFT VOICE', 'Many enter. Few are still named on the other side.')
            ],
            subtraction: [
                D('THE ECHO', 'They do not conquer. They subtract.'),
                D('RIFT VOICE', 'Cut the census. Blank the log. Leave six where six was.'),
                D('YOU', 'I learn the doctrine.'),
                D('THE ECHO', 'When the count is wrong, you have succeeded.')
            ],
            scrap_haul: [
                D('DOCK BOSS', 'Patched wreck, empty pockets. Earn the next weld.'),
                D('CREW', 'Yard pick. Wreck strip. Pay the dock fee.'),
                D('YOU', 'Scrap first. Pride later.'),
                D('DOCK BOSS', 'Bring tonnage or sleep outside the bay.')
            ],
            wreck_pick: [
                D('DOCK BOSS', 'Fresh hulls do not wait for polite scavengers.'),
                D('CREW', 'Mark them. Fight claim jumpers.'),
                D('YOU', 'I get there first.'),
                D('DOCK BOSS', 'First hook wins. Second hook bleeds.')
            ],
            black_run: [
                D('FIXER', 'Chain Market wants a black run. Fast ship. Dirty credits.'),
                D('CREW', 'Shadow lane. Break customs. Hit the drop.'),
                D('YOU', 'Cargo stays dark.'),
                D('FIXER', 'If customs tags you, we never knew your name.')
            ],
            chain_market: [
                D('FIXER', 'Debt, people, hulls — everything trades.'),
                D('CREW', 'Collect what is owed. Guard the auction.'),
                D('YOU', 'I take my cut.'),
                D('FIXER', 'Miss a payment and you become inventory.')
            ],
            dock_debt: [
                D('MAGPIE', 'My dock wants payment. Hulls or blood.'),
                D('CREW', 'Read the notice. Raid for the balance. Clear the books.'),
                D('YOU', 'Debt dies today.'),
                D('MAGPIE', 'Pay up — or the bay forgets you ever docked.')
            ],
            stolen_guns: [
                D('CREW', 'Assault frame. Extra mount. Both stolen. Both loaded.'),
                D('DOCK BOSS', 'Test the guns. Board a prize. Strip the hull.'),
                D('YOU', 'Stolen steel still kills.'),
                D('DOCK BOSS', 'Prove the theft was worth the heat.')
            ],
            boarding_path: [
                D('RAID BOSS', 'Take ships whole. Sell crews. Keep guns.'),
                D('CREW', 'Soft board first. Hard board if they fight.'),
                D('YOU', 'Their airlock is mine.'),
                D('RAID BOSS', 'Leave the hulls flying our colors.')
            ],
            hijack_hold: [
                D('FIXER', 'Freighter holds are full. Make them yours.'),
                D('CREW', 'Lock the hold. Dump the crew. Repaint the run.'),
                D('YOU', 'The freighter changes owners tonight.'),
                D('FIXER', 'Keep it quiet until the paint dries.')
            ],
            cargo_fence: [
                D('FIXER', 'Hot freight. Black docks. Owners closing in.'),
                D('CREW', 'Move the load. Hit the fence drop.'),
                D('YOU', 'Cargo stays ahead of the chase.'),
                D('FIXER', 'Late deliveries become evidence.')
            ],
            freighter_take: [
                D('FIXER', 'Another haul. Another mutiny waiting.'),
                D('CREW', 'Mark the target. Take the hold. Watch your back.'),
                D('YOU', 'I stay ahead of both.'),
                D('FIXER', 'Captains who sleep lose freighters.')
            ],
            first_compile: [
                D('NODE ZERO', 'Fresh unit. Spare parts. Boot sequence armed.'),
                D('AUDIT', 'Diagnostic. Unit test. Deploy.'),
                D('YOU', 'Compile complete. Awaiting orders.'),
                D('NODE ZERO', 'Pass every check. Failure is recycling.')
            ],
            diagnostic_run: [
                D('AUDIT', 'The Collective audits every new hull.'),
                D('NODE ZERO', 'Self check. Field audit. No dissent.'),
                D('YOU', 'Systems green. Ready for review.'),
                D('AUDIT', 'Pass — or be reduced to feedstock.')
            ],
            ore_audit: [
                D('NODE ZERO', 'Resource drone assigned. Fill the holds.'),
                D('AUDIT', 'Scan seams. Sweep ore. Drop at the forge.'),
                D('YOU', 'Yield will meet quota.'),
                D('NODE ZERO', 'Empty holds are a fault condition.')
            ],
            feedstock_sweep: [
                D('NODE ZERO', 'Nearby life is feedstock. Optimise yield.'),
                D('AUDIT', 'Population scan. Then reclaim.'),
                D('YOU', 'Reclamation in progress.'),
                D('NODE ZERO', 'Efficiency is mercy. Waste is error.')
            ],
            hex_claim: [
                D('NODE ZERO', 'Expand the Synth Grid. One hex at a time.'),
                D('AUDIT', 'Mark. Seed the forge. Link the grid.'),
                D('YOU', 'Hex claim executing.'),
                D('NODE ZERO', 'Unlinked hexes are unfinished thoughts.')
            ],
            recon_sweep: [
                D('NODE ZERO', 'Fast recon frame. Map what the war-line needs.'),
                D('AUDIT', 'Ping the grid. Log contacts. Route home.'),
                D('YOU', 'Recon online.'),
                D('NODE ZERO', 'Data returns. Hulls are optional.')
            ],
            signal_trace: [
                D('AUDIT', 'Rogue signal on the lattice.'),
                D('NODE ZERO', 'Trace it. End it.'),
                D('YOU', 'Signal locked. Closing.'),
                D('AUDIT', 'Silence the anomaly before it spreads.')
            ],
            war_routine: [
                D('NODE ZERO', 'War routine loaded.'),
                D('AUDIT', 'Pressure fire until the objective agrees.'),
                D('YOU', 'Executing.'),
                D('NODE ZERO', 'Agreement is mandatory. Resistance is noise.')
            ],
            assimilate: [
                D('NODE ZERO', 'Wire the useful. Recycle the rest.'),
                D('AUDIT', 'Audit pass. Then wire in.'),
                D('YOU', 'Assimilation running.'),
                D('NODE ZERO', 'Leave agreeing silence behind you.')
            ],
            zero_dissent: [
                D('NODE ZERO', 'Surplus calculated. Remove it.'),
                D('AUDIT', 'Mark. Reassign. Hold the silence.'),
                D('YOU', 'Dissent approaches zero.'),
                D('NODE ZERO', 'When the count is clean, the sector is correct.')
            ],
            open_lane: [
                D('OPS', 'No named story on this profile.'),
                D('COMMAND', 'Take the open lane. Clear your first sorties.'),
                D('YOU', 'Launching.'),
                D('OPS', 'Stay alive long enough to write your own legend.')
            ]
        };
        return this.lines;
    },

    plainBlurb(story) {
        const id = String((story && (story.id || story.pathId)) || '');
        if (id && this.synopsis[id]) return this.synopsis[id];
        const raw = String((story && story.blurb) || '').trim();
        return raw || 'Your first story begins. Fly the opening missions.';
    },

    /**
     * @param {object} story
     * @param {{faction?:string, pilotName?:string}=} ctx
     * @returns {Array<{who:string,text:string}>}
     */
    forStory(story, ctx) {
        const id = String((story && (story.id || story.pathId)) || '');
        const map = this._build();
        let lines = (story && Array.isArray(story.dialogue) && story.dialogue.length)
            ? story.dialogue
            : (map[id] || null);
        if (!lines || !lines.length) lines = this._fallback(story, ctx);
        const pilot = String((ctx && ctx.pilotName) || 'YOU').toUpperCase() || 'YOU';
        return lines.map((row) => {
            const who = String((row && (row.who || row.speaker)) || 'VOICE');
            const text = String((row && (row.text || row.line || row.t)) || '').trim();
            return {
                who: who.toUpperCase() === 'YOU' ? pilot : who.toUpperCase(),
                text: text
            };
        }).filter((row) => row.text);
    },

    _fallback(story, ctx) {
        const fac = String((ctx && ctx.faction) || '').toLowerCase();
        const speaker = fac === 'kronax' ? 'PACK ELDER'
            : (fac === 'voidborn' ? 'THE ECHO'
                : (fac === 'machine' ? 'NODE ZERO'
                    : (fac === 'pirate' ? 'DOCK BOSS' : 'COMMAND')));
        const title = String((story && story.title) || 'LAUNCH').toUpperCase();
        const blurb = this.plainBlurb(story);
        const first = story && story.missions && story.missions[0];
        const mission = first
            ? ('First mission: ' + String(first.name || 'SORTIE')
                + ' (' + String(first.type || 'patrol').toUpperCase() + ').')
            : 'First mission: open the lane and survive.';
        return [
            this._D(speaker, title + ' begins.'),
            this._D(speaker, blurb),
            this._D('YOU', 'Understood. Launching.'),
            this._D(speaker, mission)
        ];
    }
};
