document.addEventListener('DOMContentLoaded', () => {
    
    // 1. INJECT FILTER
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
                const prob = getProb(row);
                let show = true;
                if (val === 'p1' && prob > 35) show = false;
                if (val === 'p2' && (prob <= 35 || prob > 70)) show = false;
                if (val === 'p3' && prob <= 70) show = false;
                row.style.display = show ? 'flex' : 'none';
            });
        });
    }

    // 2. MAIN OBSERVER (Watches for UI changes)
    const observer = new MutationObserver(() => {
        // A. Color the Left List Items (Runs every time list updates)
        colorListItems();

        // B. Upgrade the Detail Card (Runs when card updates)
        const card = document.querySelector('.detail-card');
        if (card && !card.classList.contains('fixed')) {
            upgradeCard(card);
            card.classList.add('fixed');
        }
    });
    
    // Watch the whole body for changes (catches list updates too)
    observer.observe(document.body, { childList: true, subtree: true });

    // --- FUNCTION: COLOR LEFT LIST ITEMS ---
    function colorListItems() {
        const rows = document.querySelectorAll('.lead-row');
        rows.forEach(row => {
            // Check if we already colored it to avoid flicker
            if (row.classList.contains('phase-1') || row.classList.contains('phase-2') || row.classList.contains('phase-3')) return;

            const prob = getProb(row);
            if (prob <= 35) row.classList.add('phase-1');
            else if (prob <= 70) row.classList.add('phase-2');
            else row.classList.add('phase-3');
        });
    }

    // --- FUNCTION: UPGRADE DETAIL CARD ---
    function upgradeCard(card) {
        // 1. Color Code Background AND Progress Bar
        const scoreEl = card.querySelector('.progress-container').previousElementSibling.querySelector('strong');
        const progressBar = card.querySelector('.progress-fill');

        if (scoreEl) {
            const score = parseInt(scoreEl.innerText);
            
            // Remove old classes
            card.classList.remove('phase-1', 'phase-2', 'phase-3');
            if (progressBar) progressBar.classList.remove('phase-1', 'phase-2', 'phase-3');

            // Apply new classes based on score
            if (score <= 35) {
                card.classList.add('phase-1');
                if (progressBar) progressBar.classList.add('phase-1');
            } else if (score <= 70) {
                card.classList.add('phase-2');
                if (progressBar) progressBar.classList.add('phase-2');
            } else {
                card.classList.add('phase-3');
                if (progressBar) progressBar.classList.add('phase-3');
            }
        }

        // 2. Split Layout (Left / Right)
        const allTitles = Array.from(card.querySelectorAll('.section-title'));
        const notesTitle = allTitles.find(t => t.innerText.includes('NOTES'));
        const notesArea = card.querySelector('.notes-area');

        if (notesTitle && notesArea) {
            notesTitle.innerText = "NEXT STEPS & NOTES";
            const splitContainer = document.createElement('div');
            splitContainer.className = 'details-split-view';
            const leftCol = document.createElement('div'); leftCol.className = 'details-left';
            const rightCol = document.createElement('div'); rightCol.className = 'details-right';

            rightCol.appendChild(notesTitle);
            rightCol.appendChild(notesArea);

            const firstSectionTitle = allTitles[0]; 
            let currentNode = firstSectionTitle;
            while (currentNode && currentNode !== splitContainer) {
                const next = currentNode.nextSibling;
                leftCol.appendChild(currentNode);
                currentNode = next;
            }

            splitContainer.appendChild(leftCol);
            splitContainer.appendChild(rightCol);
            card.appendChild(splitContainer);
        }

        // 3. Pipeline Grouping
        const pipeList = card.querySelector('.pipeline-list');
        if (pipeList && !pipeList.querySelector('.phase-header')) {
            const items = Array.from(pipeList.children);
            pipeList.innerHTML = ''; 

            const addHeader = (txt, cls) => {
                const h = document.createElement('div'); h.className = `phase-header ${cls}`; h.innerText = txt; pipeList.appendChild(h);
            };

            addHeader('Phase 1: Exploration', 'p1');
            items.filter(i => i.innerText.match(/PPT|Verbal/)).forEach(i => pipeList.appendChild(i));

            addHeader('Phase 2: Validation', 'p2');
            items.filter(i => i.innerText.match(/NDA|LOI/)).forEach(i => pipeList.appendChild(i));

            addHeader('Phase 3: Execution', 'p3');
            items.filter(i => i.innerText.match(/Contract|Parts/)).forEach(i => pipeList.appendChild(i));
        }
    }

    // Helper to get probability from row text
    function getProb(row) {
        const match = row.innerText.match(/Win Prob: (\d+)%/);
        return match ? parseInt(match[1]) : 0;
    }
});
