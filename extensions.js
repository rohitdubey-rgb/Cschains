document.addEventListener('DOMContentLoaded', () => {
    
    // 1. INJECT FILTER (Only runs once)
    const filterRow = document.querySelector('.filter-row');
    if (filterRow && !document.getElementById('phaseFilter')) {
        const select = document.createElement('select');
        select.id = 'phaseFilter';
        select.className = 'filter-select';
        select.innerHTML = `
            <option value="all">All Phases</option>
            <option value="p1">Phase 1: Exploration</option>
            <option value="p2">Phase 2: Validation</option>
            <option value="p3">Phase 3: Execution</option>
        `;
        filterRow.insertBefore(select, filterRow.firstChild);
        
        select.addEventListener('change', () => {
            const val = select.value;
            document.querySelectorAll('.lead-row').forEach(row => {
                const prob = parseInt(row.innerText.match(/Win Prob: (\d+)%/) || [0,0][1]);
                let show = true;
                if (val === 'p1' && prob > 35) show = false;
                if (val === 'p2' && (prob <= 35 || prob > 70)) show = false;
                if (val === 'p3' && prob <= 70) show = false;
                row.style.display = show ? 'flex' : 'none';
            });
        });
    }

    // 2. WATCH FOR UPDATES
    const observer = new MutationObserver(() => {
        const card = document.querySelector('.detail-card');
        if (card && !card.classList.contains('fixed')) {
            upgradeCard(card);
            card.classList.add('fixed');
        }
    });
    
    const panel = document.getElementById('detailsPanel');
    if (panel) observer.observe(panel, { childList: true, subtree: true });

    function upgradeCard(card) {
        // --- A. COLOR CODING ---
        // Find the progress percentage text
        const scoreEl = card.querySelector('.progress-container').previousElementSibling.querySelector('strong');
        if (scoreEl) {
            const score = parseInt(scoreEl.innerText);
            card.classList.remove('phase-1', 'phase-2', 'phase-3');
            if (score <= 35) card.classList.add('phase-1');
            else if (score <= 70) card.classList.add('phase-2');
            else card.classList.add('phase-3');
        }

        // --- B. LAYOUT RE-ARRANGEMENT ---
        // We look for the "NOTES" title.
        const allTitles = Array.from(card.querySelectorAll('.section-title'));
        const notesTitle = allTitles.find(t => t.innerText.includes('NOTES'));
        const notesArea = card.querySelector('.notes-area');

        if (notesTitle && notesArea) {
            // Rename Title
            notesTitle.innerText = "NEXT STEPS & NOTES";

            // Create Containers
            const splitContainer = document.createElement('div');
            splitContainer.className = 'details-split-view';
            
            const leftCol = document.createElement('div');
            leftCol.className = 'details-left';
            
            const rightCol = document.createElement('div');
            rightCol.className = 'details-right';

            // MOVE NOTES TO RIGHT
            rightCol.appendChild(notesTitle);
            rightCol.appendChild(notesArea);

            // MOVE OTHERS TO LEFT
            // We move everything that is NOT the header, progress bar, or toggles
            // The "cut off" point is usually the first Section Title (Contact Info)
            
            const firstSectionTitle = allTitles[0]; // Usually "CONTACT INFORMATION"
            let currentNode = firstSectionTitle;
            
            // Move elements starting from Contact Info down to the grid
            while (currentNode && currentNode !== splitContainer) {
                const next = currentNode.nextSibling;
                leftCol.appendChild(currentNode);
                currentNode = next;
            }

            splitContainer.appendChild(leftCol);
            splitContainer.appendChild(rightCol);
            card.appendChild(splitContainer);
        }

        // --- C. PIPELINE GROUPING ---
        const pipeList = card.querySelector('.pipeline-list');
        if (pipeList && !pipeList.querySelector('.phase-header')) {
            const items = Array.from(pipeList.children);
            pipeList.innerHTML = ''; // Clear

            const addHeader = (txt, cls) => {
                const h = document.createElement('div');
                h.className = `phase-header ${cls}`;
                h.innerText = txt;
                pipeList.appendChild(h);
            };

            addHeader('Phase 1: Exploration', 'p1');
            items.filter(i => i.innerText.match(/PPT|Verbal/)).forEach(i => pipeList.appendChild(i));

            addHeader('Phase 2: Validation', 'p2');
            items.filter(i => i.innerText.match(/NDA|LOI/)).forEach(i => pipeList.appendChild(i));

            addHeader('Phase 3: Execution', 'p3');
            items.filter(i => i.innerText.match(/Contract|Parts/)).forEach(i => pipeList.appendChild(i));
        }
    }
});
