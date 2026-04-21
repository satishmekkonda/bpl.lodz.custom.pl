// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Check if user is already logged in
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in, hide the login overlay
        document.getElementById('admin-login-overlay').style.display = 'none';
    } else {
        // No user is signed in, show the overlay
        document.getElementById('admin-login-overlay').style.display = 'flex';
    }
});

function handleLogin() {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-pass').value;
    
    firebase.auth().signInWithEmailAndPassword(email, pass)
        .catch((error) => {
            document.getElementById('login-error').innerText = "Access Denied: " + error.message;
        });
}

function handleLogout() {
    firebase.auth().signOut();
}




// --- SCHEDULE GENERATION (Rotational Logic) ---
function generateSchedule() {
    // --- 1. PREVENTION: Existing Schedule ---
    // Added to prevent accidental reshuffling when you just want to view the schedul
    if (matches && matches.length > 0) {
        const confirmReshuffle = confirm("A schedule already exists, are you sure you want to RE-GENERATE?");
        if (!confirmReshuffle) {
        // If they cancel, just take them to the existing overview without changing anything
            showStep('step-schedule-overview');
            if (window.renderMatches) renderMatches();
            return; 
        }
    }

    // --- 2. DATA VALIDATION (New Safety Check) ---
    const N = advPlayers.length;
    const M = intPlayers.length;
    if (N === 0 || M === 0 || N !== M) {
        alert(`❌ DATA MISMATCH\n\nYou have ${N} Captains and ${M} Vice-Captains. \n\nBoth groups must have the same number of players to form pairs.`);
        return;
    }

    const courtLimit = parseInt(document.getElementById('court-count').value) || 1;
    const rrSets = parseInt(document.getElementById('rr-matches').value) || 1;
    const totalPairsGenerated = N * rrSets;

    // --- 3. STRICT MATH CHECK (The "Blinder" Protection) ---
    // This stops the process entirely if the math doesn't result in even matches.
    if (totalPairsGenerated % 2 !== 0) {
        alert(
            `❌ SCHEDULE BLOCKED\n\n` +
            `Current Setup: ${N} Teams x ${rrSets} Rounds = ${totalPairsGenerated} Total Pairings.\n` +
            `Problem: You cannot have a tournament with an ODD number of pairings.\n\n` +
            `FIX: Please change the 'Round Robin Number' to an EVEN number (like ${rrSets - 1} or ${rrSets + 1}) so every player plays equal number of matches.`
        );
        return; // Stops the function here. The user stays on the settings page.
    }

    // --- 4. SETUP ---
    let [startH, startM] = (document.getElementById('start-time').value || "10:00").split(':').map(Number);
    let totalMin = startH * 60 + startM;
    matches = [];
    pairs = []; 
    let allGeneratedPairs = [];

    // --- 5. GENERATE POOL ---
    for (let s = 0; s < rrSets; s++) {
        let setPairs = [];
        for (let i = 0; i < N; i++) {
            let team = {
                name: `${advPlayers[i]} & ${intPlayers[(i + s) % N]}`,
                cap: advPlayers[i],
                vc: intPlayers[(i + s) % N]
            };
            setPairs.push(team);
            
            // Register unique teams for the results table mapping
            if (!pairs.find(p => p.name === team.name)) {
                pairs.push(team);
            }
        }
        // Shuffle this set to ensure people don't play in the same order every time
        setPairs.sort(() => 0.5 - Math.random());
        allGeneratedPairs.push(...setPairs);
    }

    // --- 6. MATCHMAKING QUEUE ---
    let matchId = 1;
    let usedCourtsInCurrentSlot = 0;
    let currentRoundNumber = 1;

    while (allGeneratedPairs.length >= 2) {
        let teamA = allGeneratedPairs.shift();
        let teamB = allGeneratedPairs.shift();
        // Get indexes for scoring logic

        let idxA = pairs.findIndex(x => x.name === teamA.name);
        let idxB = pairs.findIndex(x => x.name === teamB.name);
        
        // Formating Time string (HH:MM)
        let timeStr = `${Math.floor(totalMin/60).toString().padStart(2,'0')}:${(totalMin%60).toString().padStart(2,'0')}`;

        matches.push({
            id: matchId++,
            round: currentRoundNumber,
            court: usedCourtsInCurrentSlot + 1,
            time: timeStr,
            tA: idxA, 
            tB: idxB,
            tA_cap: teamA.cap, tA_vc: teamA.vc,
            tB_cap: teamB.cap, tB_vc: teamB.vc,
            sA: '', sB: '', done: false
        });

        usedCourtsInCurrentSlot++;
        
        // When courts are full, move to the next time slot
        if (usedCourtsInCurrentSlot >= courtLimit) {
            usedCourtsInCurrentSlot = 0;
            totalMin += 20;
            currentRoundNumber++;
        }
    }

    // --- 7. FINAL RENDER & SAVE ---
    const overviewBody = document.getElementById('overview-table-body');
    if (overviewBody) {
        overviewBody.innerHTML = matches.map(m => `
            <tr>
                <td>${m.round}</td>
                <td>Court ${m.court}</td>
                <td>${m.time}</td>
                <td style="font-weight: bold;">${m.tA_cap} - ${m.tA_vc} vs ${m.tB_cap} - ${m.tB_vc}</td>
            </tr>
        `).join('');
    }

    saveData(); 
    showStep('step-schedule-overview');
    if (window.renderMatches) renderMatches();
    if (window.updateLiveTable) updateLiveTable();
}

function renderMatches() {
    document.getElementById('matches-container').innerHTML = matches.map((m, i) => {
        const teamA = `<span>${m.tA_cap}</span><span class="pair-separator">-</span><span>${m.tA_vc}</span>`;
        const teamB = `<span>${m.tB_cap}</span><span class="pair-separator">-</span><span>${m.tB_vc}</span>`;

        return `
        <div class="match-card">
            <div class="match-meta-left">
                <span class="round-text">R ${m.round}</span>
                <span class="time-text">${m.time}</span>
                <span class="court-text">C ${m.court}</span>
            </div>
            <div class="match-content">
                <div class="player-wrapper">
                    <div class="player-name-left">${teamA}</div>
                    <div class="score-container" style="position:relative;">
                        <input type="number" id="m-${i}-a" value="${m.sA || ''}" class="score-input ${m.done ? 'valid' : ''}" oninput="upd(${i}, 'a')" placeholder="0">
                        <span class="score-separator">-</span>
                        <input type="number" id="m-${i}-b" value="${m.sB || ''}" class="score-input ${m.done ? 'valid' : ''}" oninput="upd(${i}, 'b')" placeholder="0">
                        <div id="hint-${i}" class="error-hint"></div>
                    </div>
                    <div class="player-name-right">${teamB}</div>
                </div>
            </div>
        </div>`;
    }).join('');
}


function upd(i, side) {
    const inpA = document.getElementById(`m-${i}-a`);
    const inpB = document.getElementById(`m-${i}-b`);
    const hint = document.getElementById(`hint-${i}`);
    const valA = parseInt(inpA.value);
    const valB = parseInt(inpB.value);
    matches[i].sA = inpA.value;
    matches[i].sB = inpB.value;
    const hasScore = !isNaN(valA) && !isNaN(valB);
    let isValidMatch = false;
    let errorMsg = "";

    if (hasScore) {
        const high = Math.max(valA, valB);
        const low = Math.min(valA, valB);
        const diff = high - low;
        if (high < 21) errorMsg = "Winner must reach 21";
        else if (high === 21) {
            if (low <= 19) isValidMatch = true; 
            else errorMsg = "Must lead by 2 (e.g., 22-20)";
        } else if (high > 21 && high < 30) {
            if (diff === 2) isValidMatch = true; 
            else if (low <= 19) errorMsg = "Game finishes at 21"; 
            else errorMsg = "Deuce! Must lead by 2";
        } else if (high === 30) {
            isValidMatch = true;
        } else if (high > 30) errorMsg = "Maximum score is 30";
    }

    matches[i].done = isValidMatch;
    hint.innerText = isValidMatch ? "" : errorMsg;
    if (hasScore) {
        inpA.classList.toggle('valid', isValidMatch); inpA.classList.toggle('invalid', !isValidMatch);
        inpB.classList.toggle('valid', isValidMatch); inpB.classList.toggle('invalid', !isValidMatch);
    }
    
    const currentInput = document.getElementById(`m-${i}-${side}`);
    if (currentInput.value.length >= 2 || parseInt(currentInput.value) > 9) {
        if (side === 'a') { inpB.focus(); } 
        else if (matches[i+1]) { document.getElementById(`m-${i+1}-a`).focus(); }
    }
    let pct = Math.round((matches.filter(m => m.done).length / matches.length) * 100);
    document.getElementById('p-bar').style.width = pct + '%';
    document.getElementById('p-text').innerText = `Progress: ${pct}%`;
    updateLiveTable(); 
saveData();
}

function updateLiveTable() {
    let stats = {};
    // Initialize all players (Captains and VCs)
    [...advPlayers, ...intPlayers].forEach(name => {
        stats[name] = { name, played: 0, wins: 0, lost: 0, points: 0, score: 0 };
    });

    matches.forEach(m => {
        if (!m.done) return;
        const sA = parseInt(m.sA), sB = parseInt(m.sB);
        const playersA = [m.tA_cap, m.tA_vc];
        const playersB = [m.tB_cap, m.tB_vc];

        // Update Played and Score for everyone
        playersA.forEach(p => { stats[p].played++; stats[p].score += sA; });
        playersB.forEach(p => { stats[p].played++; stats[p].score += sB; });

        if (sA > sB) {
            playersA.forEach(p => { stats[p].wins++; stats[p].points += 2; });
            playersB.forEach(p => { stats[p].lost++; });
        } else {
            playersB.forEach(p => { stats[p].wins++; stats[p].points += 2; });
            playersA.forEach(p => { stats[p].lost++; });
        }
    });

    let sorted = Object.values(stats).sort((a, b) => b.points - a.points || b.score - a.score);

    document.getElementById('live-body').innerHTML = sorted.map(p => 
        `<tr><td>${p.name}</td><td>${p.played}</td><td>${p.wins}</td><td>${p.lost}</td><td>${p.points}</td><td>${p.score}</td></tr>`
    ).join('');
}

function calculateResults() {
    updateLiveTable(); // Re-runs the logic to ensure data is fresh

    const recap = document.getElementById('recap-table');
    recap.innerHTML = '<thead><tr><th>Round</th><th>Match</th><th>Result</th></tr></thead>';
    const recapBody = document.createElement('tbody');
    
    matches.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.round}</td>
            <td>${m.tA_cap} & ${m.tA_vc} vs ${m.tB_cap} & ${m.tB_vc}</td>
            <td>${m.done ? `<strong>${m.sA} - ${m.sB}</strong>` : '<em>Pending</em>'}</td>
        `;
        recapBody.appendChild(tr);
    });
    recap.appendChild(recapBody);

    showStep('results-section');
}

function showLeaderboard() {
    // 1. Calculate Individual Stats
    let stats = {};
    [...advPlayers, ...intPlayers].forEach(name => {
        stats[name] = { name, played: 0, wins: 0, lost: 0, points: 0, score: 0 };
    });

    matches.forEach(m => {
        if (!m.done) return;
        const sA = parseInt(m.sA), sB = parseInt(m.sB);
        [m.tA_cap, m.tA_vc].forEach(p => { 
            stats[p].played++; stats[p].score += sA; 
            if(sA > sB) { stats[p].wins++; stats[p].points += 2; } else { stats[p].lost++; }
        });
        [m.tB_cap, m.tB_vc].forEach(p => { 
            stats[p].played++; stats[p].score += sB; 
            if(sB > sA) { stats[p].wins++; stats[p].points += 2; } else { stats[p].lost++; }
        });
    });

    let sorted = Object.values(stats).sort((a,b) => b.points - a.points || b.score - a.score);
    
    // 2. Render Table (Same look as Live Standings)
    document.getElementById('table-body').innerHTML = sorted.map((p, i) => {
        let rowClass = (i < 2) ? 'highlight-finalist' : (i < 4 ? 'highlight-qualified' : '');
        return `
            <tr class="${rowClass}">
                <td>${i+1}</td>
                <td>${p.name}</td>
                <td>${p.played}</td>
                <td>${p.wins}</td>
                <td>${p.lost}</td>
                <td>${p.points}</td>
                <td>${p.score}</td>
            </tr>`;
    }).join('');

    // 3. Playoff Logic (Top 4 individuals play singles/chosen format)
    // 3. New Playoff Logic: Pairing top 8 players based on rank and role
    // 3. New Playoff Logic: Role-based Ranking Priority Pairing
    // 3. Playoff Logic: Strictly Top 8 Ranking Priority
    // 3. Playoff Logic: Strictly Top 8 Ranking Priority
    if (sorted.length >= 8) {
        if (!playoffScores.q1.done && !playoffScores.q1.sA && !playoffScores.q1.sB) {
            
            let playoffTeams = [];
            let pairedNames = new Set();
            const top8 = sorted.slice(0, 8);

            for (let i = 0; i < top8.length; i++) {
                let p1 = top8[i];
                if (pairedNames.has(p1.name)) continue;

                const isP1Captain = advPlayers.includes(p1.name);
                let p2 = null;

                // STRATEGY A: Find highest ranked opposite role in the remaining top 8
                for (let j = 0; j < top8.length; j++) {
                    let potential = top8[j];
                    if (p1.name !== potential.name && !pairedNames.has(potential.name)) {
                        // Check if they are opposite roles
                        if (isP1Captain !== advPlayers.includes(potential.name)) {
                            p2 = potential;
                            break;
                        }
                    }
                }

                // STRATEGY B: Fallback - If no opposite role left in top 8, take the next best rank
                if (!p2) {
                    for (let j = 0; j < top8.length; j++) {
                        let potential = top8[j];
                        if (p1.name !== potential.name && !pairedNames.has(potential.name)) {
                            p2 = potential;
                            break;
                        }
                    }
                }

                if (p1 && p2) {
                    pairedNames.add(p1.name);
                    pairedNames.add(p2.name);
                    
                    // FIXED LOGIC: 
                    // Since p1 comes from the outer loop 'i', it is always higher ranked 
                    // (or equal to) p2. By putting p1 first, we respect the leaderboard order.
                    let teamName = `${p1.name} - ${p2.name}`;
                    
                    playoffTeams.push(teamName);
                }
            }

            // Assign the 4 formed teams to the bracket
            if (playoffTeams.length === 4) {
                playoffScores.q1.teamA = playoffTeams[0];   
                playoffScores.q1.teamB = playoffTeams[1];   
                playoffScores.elim.teamA = playoffTeams[2]; 
                playoffScores.elim.teamB = playoffTeams[3]; 
            }
        }
    }

    // 4. Render Playoff Cards (Keeping your exact input logic)
    const container = document.getElementById('playoff-matches-container');
    container.innerHTML = '';
    container.appendChild(createMatchInput('Qualifier 1 (Rank 1 vs 2)', 'q1', playoffScores.q1));
    container.appendChild(createMatchInput('Eliminator (Rank 3 vs 4)', 'elim', playoffScores.elim));
    container.appendChild(createMatchInput('Qualifier 2', 'q2', playoffScores.q2));
    container.appendChild(createMatchInput('Grand Final', 'final', playoffScores.final));

    // Winner Display
    if (playoffScores.final.done) {
        const champName = parseInt(playoffScores.final.sA) > parseInt(playoffScores.final.sB) ? playoffScores.final.teamA : playoffScores.final.teamB;
        let champDiv = document.getElementById('champ-win') || document.createElement('div');
        champDiv.id = 'champ-win';
        champDiv.innerHTML = `<div style="text-align:center; font-size:1.5em; color:#16a34a; font-weight:bold; margin-top:20px;">🏆 CHAMPIONS: ${champName} 🏆</div>`;
        container.appendChild(champDiv);
    }
    
    saveData();
    showStep('leaderboard-section');
}

// Function to handle the Reset Playoff Bracket logic
function resetPlayoffs() {
    if (confirm("Reset playoff scores? This will clear all playoff results but keep your Group Stage data.")) {
        playoffScores = {
            q1: { sA: '', sB: '', done: false, teamA: '', teamB: '' },
            elim: { sA: '', sB: '', done: false, teamA: '', teamB: '' },
            q2: { sA: '', sB: '', done: false, teamA: '', teamB: '' },
            final: { sA: '', sB: '', done: false, teamA: '', teamB: '' }
        };
        saveData();
        showLeaderboard(); 
    }
}

// 3. Helper to create HTML for match inputs
function createMatchInput(title, id, match) {
    const div = document.createElement('div');
    div.className = 'playoff-match-card';
    // Added "position: relative" to help with alignment during capture
    div.style = "border:1px solid #e2e8f0; border-radius:8px; padding:15px; margin-bottom:10px; background:#fff; position: relative;";
    
    div.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #1e3a8a;">${title}</h4>
        <div style="display:flex; justify-content:center; align-items:center; gap:10px;">
            <span id="${id}-nameA" style="font-weight:bold; width: 140px; text-align: right;">${match.teamA || 'TBD'}</span>
            
            <div style="position: relative; width: 50px; height: 30px;">
                <input type="number" id="${id}-a" value="${match.sA}" oninput="updatePlayoffScore('${id}', 'a')" 
                       style="width:100%; text-align:center; padding: 5px; border: 1px solid #cbd5e1; border-radius: 4px;" placeholder="0">
                <span class="export-only-score" style="display:none; position:absolute; top:5px; left:0; width:100%; text-align:center; font-weight:bold;">${match.sA}</span>
            </div>

            <span style="font-weight:bold;">-</span>

            <div style="position: relative; width: 50px; height: 30px;">
                <input type="number" id="${id}-b" value="${match.sB}" oninput="updatePlayoffScore('${id}', 'b')" 
                       style="width:100%; text-align:center; padding: 5px; border: 1px solid #cbd5e1; border-radius: 4px;" placeholder="0">
                <span class="export-only-score" style="display:none; position:absolute; top:5px; left:0; width:100%; text-align:center; font-weight:bold;">${match.sB}</span>
            </div>

            <span id="${id}-nameB" style="font-weight:bold; width: 140px; text-align: left;">${match.teamB || 'TBD'}</span>
        </div>
        <div id="${id}-hint" style="color:#ef4444; font-size:0.8em; text-align:center; margin-top:5px; height: 1em;"></div>
    `;
    return div;
}

// 4. The updated logic for Focus and Names
function updatePlayoffScore(matchId, side) {
    const inpA = document.getElementById(`${matchId}-a`);
    const inpB = document.getElementById(`${matchId}-b`);
    const valA = parseInt(inpA.value);
    const valB = parseInt(inpB.value);
    
    playoffScores[matchId].sA = inpA.value;
    playoffScores[matchId].sB = inpB.value;

    // Validation
    let isValidMatch = false;
    let errorMsg = ""; // Added to track specific error messages

    if (!isNaN(valA) && !isNaN(valB)) {
        const high = Math.max(valA, valB);
        const low = Math.min(valA, valB);
        const diff = high - low;

        if (high < 21) {
            errorMsg = "Winner must reach 21";
        } else if (high === 21) {
            if (low <= 19) isValidMatch = true; 
            else errorMsg = "Must lead by 2 (e.g., 22-20)";
        } else if (high > 21 && high < 30) {
            if (diff === 2) isValidMatch = true; 
            else errorMsg = "Deuce! Must lead by 2";
        } else if (high === 30) {
            isValidMatch = true;
        } else if (high > 30) {
            errorMsg = "Maximum score is 30"; // Matches Group Stage logic
        }
    }

    playoffScores[matchId].done = isValidMatch;
    // Updated to show the specific errorMsg
    document.getElementById(`${matchId}-hint`).innerText = (inpA.value && inpB.value && !isValidMatch) ? errorMsg : "";

    // --- AUTO FOCUS LOGIC (Exact reuse of your working logic) ---
    const currentInput = document.getElementById(`${matchId}-${side}`);
    if (currentInput.value.length >= 2 || parseInt(currentInput.value) > 9) {
        if (side === 'a') { 
            inpB.focus(); 
        } else {
            const sequence = ['q1', 'elim', 'q2', 'final'];
            const nextIdx = sequence.indexOf(matchId) + 1;
            if (sequence[nextIdx]) {
                const nextInp = document.getElementById(`${sequence[nextIdx]}-a`);
                if (nextInp) nextInp.focus();
            }
        }
    }

    // --- WINNER PROGRESSION ---
    if (isValidMatch) {
        const winner = valA > valB ? playoffScores[matchId].teamA : playoffScores[matchId].teamB;
        const loser = valA > valB ? playoffScores[matchId].teamB : playoffScores[matchId].teamA;

        if (matchId === 'q1') {
            playoffScores.final.teamA = winner;
            playoffScores.q2.teamA = loser;
        } else if (matchId === 'elim') {
            playoffScores.q2.teamB = winner;
        } else if (matchId === 'q2') {
            playoffScores.final.teamB = winner;
        }

        // Update Names on Screen Instantly
        ['q1', 'elim', 'q2', 'final'].forEach(mId => {
            const elA = document.getElementById(`${mId}-nameA`);
            const elB = document.getElementById(`${mId}-nameB`);
            if(elA) elA.innerText = playoffScores[mId].teamA || 'TBD';
            if(elB) elB.innerText = playoffScores[mId].teamB || 'TBD';
        });

        // Show Champion if Final is done
        if (matchId === 'final' || playoffScores.final.done) {
            const fA = parseInt(playoffScores.final.sA);
            const fB = parseInt(playoffScores.final.sB);
            const champName = fA > fB ? playoffScores.final.teamA : playoffScores.final.teamB;
            let champDiv = document.getElementById('champ-win');
            if (!champDiv) {
                champDiv = document.createElement('div');
                champDiv.id = 'champ-win';
                document.getElementById('playoff-matches-container').appendChild(champDiv);
            }
            champDiv.innerHTML = `<div style="text-align:center; font-size:1.5em; color:#16a34a; font-weight:bold; margin-top:20px;">🏆 CHAMPIONS: ${champName} 🏆</div>`;
        }
    }
    // SAVE DATA AFTER EVERY KEYSTROKE
    saveData();
}

function toggleTournamentStatus() {
    const statusRef = db.ref('custom_live_tournament/finished');
    
    statusRef.once('value', (snapshot) => {
        const isFinished = snapshot.val() || false;
        const newStatus = !isFinished;
        
        // Update Firebase
        statusRef.set(newStatus);
        
        // Update Admin UI Button Appearance
        const btn = document.getElementById('finish-btn');
        if (newStatus) {
            btn.innerText = "▶ Resume Tournament";
            btn.style.backgroundColor = "#4ade80"; // Green for resume
            alert("Tournament Marked as Finished!");
        } else {
            btn.innerText = "🏆 Finish Tournament";
            btn.style.backgroundColor = "#ffd700"; // Gold for finish
            alert("Tournament Resumed!");
        }
    });
}