// js/app.js - Global State
let advPlayers = [];
let intPlayers = [];
let manualPlayers = [];
let pairs = [];
let matches = [];
let isManualMode = false;

// Playoff's global object
let playoffScores = {
    q1: { sA: '', sB: '', done: false, teamA: '', teamB: '' },
    elim: { sA: '', sB: '', done: false, teamA: '', teamB: '' },
    q2: { sA: '', sB: '', done: false, teamA: '', teamB: '' },
    final: { sA: '', sB: '', done: false, teamA: '', teamB: '' }
};

// Initialize EmailJS 
(function(){ emailjs.init("YOUR_PUBLIC_KEY"); })();
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    document.getElementById('date-display').innerText = today;
    
// The "Startup" function - This runs only when the page is fully ready

window.onload = function() {
    // Set Date
    const dateDisplay = document.getElementById('date-display');
    if (dateDisplay) {
        const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        dateDisplay.innerText = today;
    }

    // Fill Time Dropdown (Your exact logic)
    const st = document.getElementById('start-time');
    if (st) {
        for(let h=10; h<=18; h++) {
            for(let m of ['00','30']) {
                st.options.add(new Option(`${h}:${m}`, `${h}:${m}`));
            }
        }
    }

    // Run your loadData function
    loadData();
};
	
//Not lose Entered Data on refresh
function saveData() {
    // Added playoffScores to the object below
    const data = { advPlayers, intPlayers, manualPlayers, pairs, matches, isManualMode, playoffScores }; 
    localStorage.setItem('bpl_2026_custom_data', JSON.stringify(data));

    // Mirror data to the cloud
    if (typeof db !== 'undefined') {
        db.ref('custom_live_tournament').set(data);
    }
}

function loadData() {
    const saved = localStorage.getItem('bpl_2026_custom_data');
    const lastStep = localStorage.getItem('bpl_last_step');
    
    if (saved) {
        const data = JSON.parse(saved);
        advPlayers = data.advPlayers || [];
        intPlayers = data.intPlayers || [];
        manualPlayers = data.manualPlayers || [];
        pairs = data.pairs || [];
        matches = data.matches || [];
        isManualMode = data.isManualMode || false;
        if (data.playoffScores) playoffScores = data.playoffScores;
        
        if (window.renderLists) renderLists();
        if (window.renderManualList) renderManualList();
        
        if (matches.length > 0) {
            if (window.renderMatches) renderMatches();
            if (window.updateLiveTable) updateLiveTable();

            // --- FIX: Rebuild Overview Table on load to prevent empty display ---
            const overviewBody = document.getElementById('overview-table-body');
            if (overviewBody) {
                overviewBody.innerHTML = matches.map(m => `
                    <tr>
                        <td>${m.round}</td>
                        <td>Court ${m.court}</td>
                        <td>${m.time}</td>
                        <td style="font-weight: bold;">${pairs[m.tA].name} vs ${pairs[m.tB].name}</td>
                    </tr>
                `).join('');
            }
        }

        if (lastStep && lastStep !== 'step-welcome') {
            showStep(lastStep);
            
            // 1. Logic for Review/Courts back button
            if (lastStep === 'step-review' || lastStep === 'step-courts') {
                const reviewBackBtn = document.getElementById('btn-review-back');
                if (reviewBackBtn) { // Safety check
                    if (isManualMode) {
                        reviewBackBtn.onclick = () => showStep('step-manual');
                        document.getElementById('btn-shuffle-strict').classList.add('hidden');
                        document.getElementById('btn-shuffle-random').classList.add('hidden');
                    } else {
                        reviewBackBtn.onclick = () => showStep('step-int');
                        document.getElementById('btn-shuffle-strict').classList.remove('hidden');
                        document.getElementById('btn-shuffle-random').classList.remove('hidden');
                    }
                }
                if (window.renderReview) renderReview(); 
            }

            // 2. Logic for Group Stage Stats
            if (lastStep === 'results-section') {
                if (window.calculateResults) calculateResults();
            }

            // 3. Logic for Final Leaderboard
            if (lastStep === 'leaderboard-section') {
                if (window.calculateResults) calculateResults();
                if (window.showLeaderboard) showLeaderboard();
            }
            } else {
                // NEW: If no step is saved, or we were on welcome, explicitly show welcome
                showStep('step-welcome');
            }
            } else {
                // NEW: If there is NO saved data at all (first time opening), show welcome
                showStep('step-welcome');
            }
}


function showStep(id) {
	const step = document.getElementById(id);
    if (!step) return;

    document.querySelectorAll('.container > div:not(.header-row)').forEach(d => d.classList.add('hidden')); 
    document.getElementById(id).classList.remove('hidden'); 
	
	// Always save the current step to memory
    localStorage.setItem('bpl_last_step', id);
}

// goBackFromCourts function
function goBackFromCourts() {
    showStep('step-review');
    // Re-apply the correct back-button logic for the Review screen
    if (isManualMode) {
        document.getElementById('btn-review-back').onclick = () => showStep('step-manual');
        document.getElementById('btn-shuffle-strict').classList.add('hidden');
        document.getElementById('btn-shuffle-random').classList.add('hidden');
    } else {
        document.getElementById('btn-review-back').onclick = () => showStep('step-int');
        document.getElementById('btn-shuffle-strict').classList.remove('hidden');
        document.getElementById('btn-shuffle-random').classList.remove('hidden');
    }
}

// Clears Saved Data
function clearTournament() {
    if (confirm("Are you sure? This will delete all current players, matches, and scores.")) {
        localStorage.removeItem('bpl_2026_custom_data');
        location.reload();
    }
}

