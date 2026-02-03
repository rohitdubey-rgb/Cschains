document.addEventListener('DOMContentLoaded', () => {
    
    // Watch for changes in the Details Panel (e.g. when you click a lead)
    const observer = new MutationObserver((mutations) => {
        const card = document.querySelector('.detail-card');
        
        // If card exists and we haven't fixed the layout yet
        if (card && !card.classList.contains('layout-fixed')) {
            rearrangeLayout(card);
            card.classList.add('layout-fixed'); // Mark as done so we don't loop
        }
    });

    // Start watching the panel
    const panel = document.getElementById('detailsPanel');
    if (panel) {
        observer.observe(panel, { childList: true, subtree: true });
    }

    function rearrangeLayout(card) {
        // 1. Identify Elements
        // We look for section titles to identify where sections start
        const titles = Array.from(card.querySelectorAll('.section-title'));
        const notesTitle = titles.find(el => el.textContent.includes('NOTES'));
        const notesArea = card.querySelector('.notes-area');

        if (!notesTitle || !notesArea) return;

        // 2. Rename "NOTES" to "NEXT STEPS"
        notesTitle.innerText = "NEXT STEPS / PROGRESS NOTES";

        // 3. Create the New Containers
        const gridContainer = document.createElement('div');
        gridContainer.className = 'details-grid-container';

        const leftCol = document.createElement('div');
        leftCol.className = 'details-left-col';

        const rightCol = document.createElement('div');
        rightCol.className = 'details-right-col';

        // 4. Move "Notes" stuff to Right Column
        rightCol.appendChild(notesTitle);
        rightCol.appendChild(notesArea);

        // 5. Move everything else (Contact, Team, Pipeline) to Left Column
        // We start grabbing elements from after the "Status Toggles"
        // The structure usually is: Header -> Progress -> Toggles -> Contact -> Team -> Pipeline -> Notes
        
        // Strategy: Anything currently left in the card that isn't the Header/Progress/Toggles goes to Left Col
        // We identify the "cut off" point.
        // Let's assume Contact, Team, Pipeline are the remaining blocks.
        
        const infoGrid = card.querySelectorAll('.info-grid'); // Contact & Team
        const pipeList = card.querySelector('.pipeline-list'); // Pipeline
        
        // Find titles for Contact, Team, Pipeline
        const remainingTitles = Array.from(card.querySelectorAll('.section-title')); 

        remainingTitles.forEach(title => leftCol.appendChild(title));
        infoGrid.forEach(grid => leftCol.appendChild(grid));
        if (pipeList) leftCol.appendChild(pipeList);

        // 6. Assemble
        gridContainer.appendChild(leftCol);
        gridContainer.appendChild(rightCol);
        
        // Append the new grid to the main card
        card.appendChild(gridContainer);
    }
});
