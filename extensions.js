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
                const prob = parseInt(row.innerText.match(/Win Prob: (\d+)%/) || [0,0][1]);
                let show = true;
                if (val === 'p1' && prob > 35) show = false;
                if (val === 'p2' && (prob <= 35 || prob > 70)) show = false;
                if (val === 'p3' && prob <= 70) show = false;
                row.style.display = show ? 'flex' : 'none';
            });
        });
    }

    // 2. MAIN OBSERVER
    const observer = new MutationObserver(() => {
        colorListItems();
        const card = document.querySelector('.detail-card');
        if (card && !card.classList.contains('fixed')) {
            upgradeCard(card);
            card.classList.add('fixed');
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });

    function colorListItems() {
        document.querySelectorAll('.lead-row').forEach(row => {
            if (row.classList.contains('colored')) return;
            const prob = parseInt(row.innerText.match(/Win Prob: (\d+)%/) || [0,0][1]);
            row.classList.remove('phase-1', 'phase-2', 'phase-3');
            if (prob <= 35) row.classList.add('phase-1');
            else if (prob <= 70) row.classList.add('phase-2');
            else row.classList.add('phase-3');
            row.classList.add('colored');
        });
    }

    function upgradeCard(card) {
        // A. Color Code
        const scoreEl = card.querySelector('.progress-container').previousElementSibling.querySelector('strong');
        const progressBar = card.querySelector('.progress-fill');
        if (scoreEl) {
            const score = parseInt(scoreEl.innerText);
            card.classList.remove('phase-1', 'phase-2', 'phase-3');
            if (progressBar) progressBar.classList.remove('phase-1', 'phase-2', 'phase-3');

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

        // B. Split Layout
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

            // Move everything else to Left
            const firstSectionTitle = allTitles[0]; 
            let currentNode = firstSectionTitle;
            // Stop if we hit the new split container or run out of nodes
            while (currentNode && currentNode !== splitContainer && currentNode !== notesTitle) {
                const next = currentNode.nextSibling;
                leftCol.appendChild(currentNode);
                currentNode = next;
            }

            splitContainer.appendChild(leftCol);
            splitContainer.appendChild(rightCol);
            card.appendChild(splitContainer);
        }

        // C. Pipeline Grouping
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
});
