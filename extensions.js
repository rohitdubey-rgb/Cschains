document.addEventListener('DOMContentLoaded', () => {
    
    // Watch for changes in the Details Panel
    const observer = new MutationObserver((mutations) => {
        const card = document.querySelector('.detail-card');
        
        // If card exists and we haven't fixed the layout yet
        if (card && !card.classList.contains('layout-fixed')) {
            rearrangeLayout(card);
            card.classList.add('layout-fixed'); 
        }
    });

    const panel = document.getElementById('detailsPanel');
    if (panel) {
        observer.observe(panel, { childList: true, subtree: true });
    }

    function rearrangeLayout(card) {
        // 1. Find the "Next Steps / Notes" section to move to the right
        const titles = Array.from(card.querySelectorAll('.section-title'));
        const notesTitle = titles.find(el => el.textContent.includes('NOTES'));
        const notesArea = card.querySelector('.notes-area');

        // Safety check: if standard elements aren't found, stop
        if (!notesTitle || !notesArea) return;

        // 2. Rename Notes Title
        notesTitle.innerText = "NEXT STEPS / PROGRESS NOTES";

        // 3. Create the Main Layout Grid
        const gridContainer = document.createElement('div');
        gridContainer.className = 'details-grid-container';

        const leftCol = document.createElement('div');
        leftCol.className = 'details-left-col';

        const rightCol = document.createElement('div');
        rightCol.className = 'details-right-col';

        // 4. PREPARE RIGHT COLUMN (Notes)
        // Move the Notes Title and Text Area into the Right Column
        rightCol.appendChild(notesTitle);
        rightCol.appendChild(notesArea);

        // 5. PREPARE LEFT COLUMN (Everything else)
        // We need to move the remaining elements IN ORDER so headers stay above their data.
        
        // Strategy: We know the structure from app.js is roughly:
        // [Header..] [Progress..] [Toggles..] [Title:Contact] [Grid:Contact] [Title:Team] [Grid:Team] [Title:Pipeline] [List:Pipeline]
        
        // We want to leave the Header/Progress/Toggles at the very top (outside our columns).
        // We want to move Contact, Team, and Pipeline into Left Col.

        // Let's find the specific blocks by their content/class to be safe
        const contactTitle = titles.find(el => el.textContent.includes('CONTACT'));
        const teamTitle = titles.find(el => el.textContent.includes('TEAM'));
        const pipelineTitle = titles.find(el => el.textContent.includes('PIPELINE'));
        
        const infoGrids = card.querySelectorAll('.info-grid');
        const pipelineList = card.querySelector('.pipeline-list');

        // Append in the correct visual order
        if (contactTitle) leftCol.appendChild(contactTitle);
        if (infoGrids[0]) leftCol.appendChild(infoGrids[0]); // Contact Grid

        if (teamTitle) leftCol.appendChild(teamTitle);
        if (infoGrids[1]) leftCol.appendChild(infoGrids[1]); // Team Grid

        if (pipelineTitle) leftCol.appendChild(pipelineTitle);
        if (pipelineList) leftCol.appendChild(pipelineList);

        // 6. Final Assemble
        gridContainer.appendChild(leftCol);
        gridContainer.appendChild(rightCol);
        
        // Append the whole grid to the card
        card.appendChild(gridContainer);
    }
});
