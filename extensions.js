document.addEventListener('DOMContentLoaded', () => {
    
    // --- JOB 1: INJECT PHASE FILTER ---
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
        // Insert as the first item in filter row
        filterRow.insertBefore(select, filterRow.firstChild);

        // Add Logic: Filter the list based on "Win Prob" text
        select.addEventListener('change', () => {
            const phase = select.value;
            const rows = document.querySelectorAll('.lead-row');

            rows.forEach(row => {
                const probText = row.innerText.match(/Win Prob: (\d+)%/);
                let show = true;

                if (probText) {
                    const score = parseInt(probText[1]);
                    if (phase === 'p1' && score > 35) show = false;
                    if (phase === 'p2' && (score <= 35 || score > 70)) show = false;
                    if (phase === 'p3' && score <= 70) show = false;
                }

                // Toggle visibility
                row.style.display = show ? 'flex' : 'none';
            });
        });
    }

    // --- JOB 2 & 3: WATCH DETAILS PANEL & UPGRADE IT ---
    const observer = new MutationObserver((mutations) => {
        const card = document.querySelector('.detail-card');
        
        // If card exists and we haven't processed it yet
        if (card && !card.classList.contains('ext-processed')) {
            upgradeCard(card);
            card.classList.add('ext-processed'); // Mark as done to prevent loops
        }
    });

    const panel = document.getElementById('detailsPanel');
    if (panel) observer.observe(panel, { childList: true, subtree: true });


    function upgradeCard(card) {
        // --- A. REARRANGE LAYOUT (Preserve previous logic) ---
        const notesTitle = Array.from(card.querySelectorAll('.section-title')).find(el => el.textContent.includes('NOTES'));
        const notesArea = card.querySelector('.notes-area');

        if (notesTitle && notesArea) {
            notesTitle.innerText = "NEXT STEPS / PROGRESS NOTES";
            const grid = document.createElement('div'); grid.className = 'details-grid-container';
            const left = document.createElement('div'); left.className = 'details-left-col';
            const right = document.createElement('div'); right.className = 'details-right-col';

            // Move Notes to Right
            right.appendChild(notesTitle);
            right.appendChild(notesArea);

            // Move everything else to Left
            // We select specific blocks to ensure order
            const contactTitle = Array.from(card.querySelectorAll('.section-title')).find(el => el.textContent.includes('CONTACT'));
            const teamTitle = Array.from(card.querySelectorAll('.section-title')).find(el => el.textContent.includes('TEAM'));
            const pipeTitle = Array.from(card.querySelectorAll('.section-title')).find(el => el.textContent.includes('PIPELINE'));
            const grids = card.querySelectorAll('.info-grid');
            const pipeList = card.querySelector('.pipeline-list');

            if(contactTitle) left.appendChild(contactTitle);
            if(grids[0]) left.appendChild(grids[0]);
            if(teamTitle) left.appendChild(teamTitle);
            if(grids[1]) left.appendChild(grids[1]);
            if(pipeTitle) left.appendChild(pipeTitle);
            if(pipeList) left.appendChild(pipeList);

            grid.appendChild(left);
            grid.appendChild(right);
            card.appendChild(grid);
        }

        // --- B. GROUP PIPELINE ITEMS INTO PHASES ---
        const list = card.querySelector('.pipeline-list');
        if (list) {
            const items = Array.from(list.children); // Get all existing rows
            list.innerHTML = ''; // Clear the list to rebuild it

            const p1 = createHeader('Phase 1: Exploration', 'p1');
            const p2 = createHeader('Phase 2: Validation', 'p2');
            const p3 = createHeader('Phase 3: Execution', 'p3');

            list.appendChild(p1);
            moveItems(list, items, ['PPTs', 'Verbal']); // Keywords for Phase 1

            list.appendChild(p2);
            moveItems(list, items, ['NDA', 'LOI']); // Keywords for Phase 2

            list.appendChild(p3);
            moveItems(list, items, ['Contract', 'Parts']); // Keywords for Phase 3
        }

        // --- C. COLOR CODE BACKGROUND ---
        const scoreEl = card.querySelector('.detail-card strong'); // Finds the "59%" text
        if (scoreEl) {
            const score = parseInt(scoreEl.innerText.replace('%', ''));
            card.classList.remove('phase-1', 'phase-2', 'phase-3');
            
            if (score <= 35) card.classList.add('phase-1');
            else if (score <= 70) card.classList.add('phase-2');
            else card.classList.add('phase-3');
        }
    }

    // Helper: Move items that match keywords
    function moveItems(container, allItems, keywords) {
        allItems.forEach(item => {
            if (keywords.some(k => item.innerText.includes(k))) {
                container.appendChild(item);
            }
        });
    }

    // Helper: Create Header Div
    function createHeader(text, type) {
        const div = document.createElement('div');
        div.className = `phase-header ${type}`;
        div.innerText = text;
        return div;
    }
});
