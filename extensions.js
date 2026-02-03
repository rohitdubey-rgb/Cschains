document.addEventListener('DOMContentLoaded', () => {
    
    // 1. INJECT THE PHASE FILTER (Only once)
    const filterRow = document.querySelector('.filter-row');
    if (filterRow && !document.getElementById('phaseFilter')) {
        const select = document.createElement('select');
        select.id = 'phaseFilter';
        select.className = 'filter-select';
        select.innerHTML = `
            <option value="all">All Phases</option>
            <option value="p1">Phase 1: Exploration (0-35%)</option>
            <option value="p2">Phase 2: Validation (36-70%)</option>
            <option value="p3">Phase 3: Execution (71%+)</option>
        `;
        // Insert as the first filter
        filterRow.insertBefore(select, filterRow.firstChild);

        // Add Listener
        select.addEventListener('change', applyPhaseFilter);
        // Also re-apply filter when search/other filters change
        document.getElementById('searchInput').addEventListener('input', () => setTimeout(applyPhaseFilter, 100));
        document.getElementById('originSelect').addEventListener('change', () => setTimeout(applyPhaseFilter, 100));
        document.getElementById('typeSelect').addEventListener('change', () => setTimeout(applyPhaseFilter, 100));
    }

    // 2. WATCH FOR DETAILS PANEL CHANGES
    const observer = new MutationObserver((mutations) => {
        const card = document.querySelector('.detail-card');
        if (card && !card.classList.contains('processed')) {
            rearrangeLayout(card);     // Step A: Fix Layout (Left/Right)
            groupPipelineItems(card);  // Step B: Group Pipeline into Phases
            colorCodeCard(card);       // Step C: Color Background
            card.classList.add('processed'); 
        }
    });

    const panel = document.getElementById('detailsPanel');
    if (panel) observer.observe(panel, { childList: true, subtree: true });


    // --- FUNCTIONS ---

    // A. FILTER LOGIC (Reads "Win Prob: XX%" from the DOM row)
    function applyPhaseFilter() {
        const phase = document.getElementById('phaseFilter').value;
        const rows = document.querySelectorAll('.lead-row');

        rows.forEach(row => {
            // Find the probability text e.g. "Win Prob: 59%"
            const probText = row.innerText.match(/Win Prob: (\d+)%/);
            let show = true;

            if (probText) {
                const score = parseInt(probText[1]);
                if (phase === 'p1' && score > 35) show = false;
                if (phase === 'p2' && (score <= 35 || score > 70)) show = false;
                if (phase === 'p3' && score <= 70) show = false;
            }

            // Respect existing filters (if app.js hid it, keep it hidden)
            if (row.style.display === 'none' && show === false) {
                // Already hidden, do nothing
            } else {
                row.style.display = show ? 'flex' : 'none';
            }
        });
    }

    // B. GROUP PIPELINE ITEMS
    function groupPipelineItems(card) {
        const list = card.querySelector('.pipeline-list');
        if (!list) return;

        const items = Array.from(list.children);
        
        // Define Categories
        const phase1 = createHeader('Phase 1: Exploration', 'p1');
        const phase2 = createHeader('Phase 2: Validation', 'p2');
        const phase3 = createHeader('Phase 3: Execution', 'p3');

        // Clear list and rebuild in order
        list.innerHTML = '';

        list.appendChild(phase1);
        // Phase 1 Items: PPTs, Verbal (Usually items 0 and 1)
        safeAppend(list, items, ['PPTs', 'Verbal']);

        list.appendChild(phase2);
        // Phase 2 Items: NDA, LOI (Items 2, 3, 4)
        safeAppend(list, items, ['NDA', 'LOI']);

        list.appendChild(phase3);
        // Phase 3 Items: Contract, Parts (Items 5, 6)
        safeAppend(list, items, ['Contract', 'Parts']);
    }

    function safeAppend(parent, allItems, keywords) {
        allItems.forEach(item => {
            if (keywords.some(k => item.innerText.includes(k))) {
                parent.appendChild(item);
            }
        });
    }

    function createHeader(text, type) {
        const div = document.createElement('div');
        div.className = `phase-header ${type}`;
        div.innerText = text;
        return div;
    }

    // C. COLOR CODE CARD
    function colorCodeCard(card) {
        // Find the percentage text in the progress section
        // Structure is usually: <span>Pipeline Progress</span> <strong>59%</strong>
        const strongTag = card.querySelector('.detail-card strong');
        if (!strongTag) return;

        const percentage = parseInt(strongTag.innerText.replace('%', ''));
        
        card.classList.remove('bg-phase-1', 'bg-phase-2', 'bg-phase-3');

        if (percentage <= 35) card.classList.add('bg-phase-1');
        else if (percentage <= 70) card.classList.add('bg-phase-2');
        else card.classList.add('bg-phase-3');
    }

    // D. REARRANGE LAYOUT (Your previous request)
    function rearrangeLayout(card) {
        const titles = Array.from(card.querySelectorAll('.section-title'));
        const notesTitle = titles.find(el => el.textContent.includes('NOTES'));
        const notesArea = card.querySelector('.notes-area');

        if (!notesTitle || !notesArea) return;

        notesTitle.innerText = "NEXT STEPS / PROGRESS NOTES";

        const gridContainer = document.createElement('div');
        gridContainer.className = 'details-grid-container';

        const leftCol = document.createElement('div');
        leftCol.className = 'details-left-col';

        const rightCol = document.createElement('div');
        rightCol.className = 'details-right-col';

        rightCol.appendChild(notesTitle);
        rightCol.appendChild(notesArea);

        // Move Contact, Team, Pipeline to Left
        const contactTitle = titles.find(el => el.textContent.includes('CONTACT'));
        const teamTitle = titles.find(el => el.textContent.includes('TEAM'));
        const pipelineTitle = titles.find(el => el.textContent.includes('PIPELINE'));
        const infoGrids = card.querySelectorAll('.info-grid');
        const pipelineList = card.querySelector('.pipeline-list');

        if (contactTitle) leftCol.appendChild(contactTitle);
        if (infoGrids[0]) leftCol.appendChild(infoGrids[0]);
        if (teamTitle) leftCol.appendChild(teamTitle);
        if (infoGrids[1]) leftCol.appendChild(infoGrids[1]);
        if (pipelineTitle) leftCol.appendChild(pipelineTitle);
        if (pipelineList) leftCol.appendChild(pipelineList);

        gridContainer.appendChild(leftCol);
        gridContainer.appendChild(rightCol);
        card.appendChild(gridContainer);
    }
});
