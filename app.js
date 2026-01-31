document.addEventListener('DOMContentLoaded', () => {
    // --- Config ---
    const API_URL = 'https://script.google.com/macros/s/AKfycbypx_E-8wEvZc0os8z1ujejISPfTaG3MZHTEUeC2ABpZIKtPit6jJ5GQJxg0Zuy8abDxA/exec';
    
    // --- State ---
    const state = {
        allLeads: [],
        filteredLeads: [],
        selectedLeadId: null,
        sort: { field: 'score', direction: 'desc' } // Default: Show leads closest to closing first
    };

    // --- DOM ---
    const dom = {
        listContainer: document.getElementById('leadsListContainer'),
        detailsPanel: document.getElementById('detailsPanel'),
        searchInput: document.getElementById('searchInput'),
        listCount: document.getElementById('listCount'),
        totalCount: document.getElementById('totalCount'),
        refreshBtn: document.getElementById('refreshBtn'),
        lastUpdated: document.getElementById('lastUpdated'),
        // Dropdowns
        originSelect: document.getElementById('originSelect'),
        typeSelect: document.getElementById('typeSelect'),
        managerSelect: document.getElementById('managerSelect'),
        stageSelect: document.getElementById('stageSelect'),
        // Sort Headers
        sortBtns: {
            customer: document.getElementById('sortCustomer'),
            origin: document.getElementById('sortOrigin'),
            manager: document.getElementById('sortManager'),
            followup: document.getElementById('sortFollowup')
        }
    };

    init();

    function init() {
        fetchData();
        setupEventListeners();
    }

    // --- Data Fetching ---
    async function fetchData() {
        try {
            dom.listContainer.innerHTML = '<div class="loading-state">Fetching leads...</div>';
            const response = await fetch(API_URL);
            const data = await response.json();
            
            console.log("🔥 Sheet Data:", data);

            // Normalize data to internal format
            state.allLeads = data.map((item, index) => normalizeLead(item, index));
            
            // Populate dynamic dropdowns (Managers/Origins)
            populateFilters();
            
            // Render
            applyFiltersAndSort();
            updateTimestamp();
            
            // Auto-select first
            if (state.filteredLeads.length > 0) selectLead(state.filteredLeads[0].id);
        } catch (error) {
            console.error('Fetch Error:', error);
            dom.listContainer.innerHTML = '<div class="loading-state" style="color:red">Error loading data. Try Refresh.</div>';
        }
    }

    // --- Normalization Logic ---
    function normalizeLead(item, index) {
        // 1. Safe Getter: matches headers loosely (e.g. "PIM or CM" matches "pim_or_cm")
        const getValue = (targetName) => {
            const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, "");
            const keys = Object.keys(item);
            if (item[targetName] !== undefined) return item[targetName];
            const foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanTarget);
            return foundKey ? item[foundKey] : "";
        };

        const checkBool = (targetName) => {
            const val = getValue(targetName);
            const str = String(val).toLowerCase().trim();
            return val === true || str === 'true' || str === 'yes' || str === 'checked';
        };

        // 2. Field Mapping
        const company = getValue('Customer') || getValue('Company') || 'Unknown Company';
        const contact = getValue('Customer Point of Contact') || getValue('Contact') || 'Unknown Contact';
        const manager = getValue('Management Lead') || getValue('Manager') || 'Unassigned';
        const strategic = getValue('Strategic Owner') || 'Unassigned';
        const delivery = getValue('Delivery Lead') || null;
        const origin = getValue('Lead Origin') || '';
        const pimOrCmValue = getValue('PIM or CM'); // Specifically getting Col C

        // 3. Notes Cleaning (Remove timestamps)
        let notes = getValue('Notes') || getValue('Next Steps') || "No notes";
        // If note is just a date string, ignore it
        if (String(notes).match(/^\d{4}-\d{2}-\d{2}/) && String(notes).length < 25) {
            notes = "No progress notes";
        }

        // 4. Tags & Type Logic
        const tags = [];
        if (origin) tags.push({ text: origin, type: 'blue' });

        const typeStr = String(pimOrCmValue).toLowerCase().trim();
        let normalizedType = 'none';
        
        if (typeStr.includes('both')) {
            tags.push({ text: 'BOTH', type: 'both' });
            normalizedType = 'both';
        } else if (typeStr.includes('pim')) {
            tags.push({ text: 'PIM', type: 'pim' });
            normalizedType = 'pim';
        } else if (typeStr.includes('cm')) {
            tags.push({ text: 'CM', type: 'cm' });
            normalizedType = 'cm';
        }

        // 5. Pipeline Logic
        const intro = checkBool('Introductory Meeting') || checkBool('Intro');
        const weekly = checkBool('Weekly Calls');
        const ppts = checkBool('PPTs Shared');
        const verbal = checkBool('Verbal Agreement');
        const nda = checkBool('NDA Signed');
        const loi_issued = checkBool('LOI Issued') || checkBool('LOI Sent');
        const loi_signed = checkBool('LOI Signed') || checkBool('LOI Rec');
        const contract = checkBool('Contract Signed');
        const parts = checkBool('Parts & Spend Received');

        // Add status tags
        if (loi_issued) tags.push({ text: 'LOI Issued', type: 'loi' });
        if (origin.toLowerCase().includes('past') || typeStr.includes('past')) {
            tags.push({ text: 'From Past', type: 'past' });
        }

        // 6. Score Calculation (Weighted Sort)
        let score = 0;
        if (intro) score += 10;
        if (weekly) score += 5;
        if (ppts) score += 10;
        if (verbal) score += 15;
        if (nda) score += 10;
        if (loi_issued) score += 20;
        if (loi_signed) score += 30;
        if (contract) score += 50;
        if (parts) score += 10;

        return {
            id: `lead-${index}`,
            customer: company,
            contact: contact,
            manager: manager,
            strategic: strategic,
            delivery: delivery,
            notes: notes,
            tags: tags,
            origin: origin,
            type: normalizedType,
            score: score, // For sorting
            date: new Date(),
            displayDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            intro, weekly,
            pipeline: { ppts, verbal, nda, loi_issued, loi_signed, contract, parts }
        };
    }

    // --- Dynamic Filter Population ---
    function populateFilters() {
        // Unique Managers
        const managers = [...new Set(state.allLeads.map(l => l.manager))].filter(m => m && m !== 'Unassigned').sort();
        dom.managerSelect.innerHTML = '<option value="all">All Managers</option>'; // Reset
        managers.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.innerText = m;
            dom.managerSelect.appendChild(opt);
        });

        // Unique Origins
        const origins = [...new Set(state.allLeads.map(l => l.origin))].filter(o => o).sort();
        dom.originSelect.innerHTML = '<option value="all">All Origins</option>'; // Reset
        origins.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o; opt.innerText = o;
            dom.originSelect.appendChild(opt);
        });
    }

    // --- Filter & Sort ---
    function applyFiltersAndSort() {
        const query = dom.searchInput.value.toLowerCase();
        
        // Dropdown Values
        const originVal = dom.originSelect.value;
        const typeVal = dom.typeSelect.value;
        const managerVal = dom.managerSelect.value;
        const stageVal = dom.stageSelect.value;

        state.filteredLeads = state.allLeads.filter(lead => {
            // Text Search
            const matchesSearch = 
                lead.customer.toLowerCase().includes(query) || 
                lead.contact.toLowerCase().includes(query) ||
                lead.notes.toLowerCase().includes(query);
            
            // Dropdown Filters
            const matchesOrigin = originVal === 'all' || lead.origin === originVal;
            const matchesManager = managerVal === 'all' || lead.manager === managerVal;
            
            let matchesType = true;
            if (typeVal !== 'all') {
                // "PIM" matches PIM and BOTH. "CM" matches CM and BOTH.
                if (typeVal === 'both') matchesType = (lead.type === 'both');
                else if (typeVal === 'pim') matchesType = (lead.type === 'pim' || lead.type === 'both');
                else if (typeVal === 'cm') matchesType = (lead.type === 'cm' || lead.type === 'both');
            }

            let matchesStage = true;
            if (stageVal === 'contract' && !lead.pipeline.contract) matchesStage = false;
            if (stageVal === 'loi_signed' && !lead.pipeline.loi_signed) matchesStage = false;
            if (stageVal === 'loi_issued' && !lead.pipeline.loi_issued) matchesStage = false;
            if (stageVal === 'intro' && !lead.intro) matchesStage = false;

            return matchesSearch && matchesOrigin && matchesManager && matchesType && matchesStage;
        });

        // Sorting
        const { field, direction } = state.sort;
        state.filteredLeads.sort((a, b) => {
            let valA, valB;
            
            if (field === 'customer') { valA = a.customer.toLowerCase(); valB = b.customer.toLowerCase(); }
            else if (field === 'origin') { valA = a.origin.toLowerCase(); valB = b.origin.toLowerCase(); }
            else if (field === 'manager') { valA = a.manager.toLowerCase(); valB = b.manager.toLowerCase(); }
            else if (field === 'score') { valA = a.score; valB = b.score; } // Weighted Sort
            
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        renderList();
    }

    // --- Rendering ---
    function renderList() {
        dom.listContainer.innerHTML = '';
        dom.listCount.innerText = state.filteredLeads.length;
        dom.totalCount.innerText = state.allLeads.length;

        if (state.filteredLeads.length === 0) {
            dom.listContainer.innerHTML = '<div class="empty-state">No leads match.</div>';
            return;
        }

        state.filteredLeads.forEach(lead => {
            const row = document.createElement('div');
            row.className = `lead-row ${state.selectedLeadId === lead.id ? 'active' : ''}`;
            row.onclick = () => selectLead(lead.id);

            const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
            const introClass = lead.intro ? 'dot-green' : 'dot-gray';
            const weeklyClass = lead.weekly ? 'dot-green' : 'dot-gray';

            // Show score in follow up col for reference
            row.innerHTML = `
                <div class="lead-icon-col"><div class="icon-circle">📄</div></div>
                <div class="lead-content-col">
                    <div class="lead-header-row"><span class="lead-name">${lead.customer}</span>${tagsHtml}</div>
                    <div class="lead-notes">${lead.notes}</div>
                </div>
                <div class="lead-meta-col">
                    <div class="status-indicators">
                        <div class="status-dot"><span class="dot ${introClass}"></span> Intro</div>
                        <div class="status-dot"><span class="dot ${weeklyClass}"></span> Weekly</div>
                    </div>
                    <div style="font-size:0.7rem; color:#9ca3af">Win Prob: ${lead.score}%</div>
                </div>
            `;
            dom.listContainer.appendChild(row);
        });
    }

    function selectLead(id) {
        state.selectedLeadId = id;
        renderList();
        const lead = state.allLeads.find(l => l.id === id);
        renderDetails(lead);
    }

    function renderDetails(lead) {
        if (!lead) return;

        const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
        const checkIcon = `<svg width="16" height="16" stroke="var(--success)" fill="none" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
        const xIcon = `<svg width="16" height="16" stroke="var(--text-light)" fill="none" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        
        const pipeRow = (label, active) => `
            <div class="pipeline-item">
                <span>${label}</span>
                <span class="${active ? 'status-text-yes' : 'status-text-no'}">${active ? 'Yes' : 'No'}</span>
            </div>`;

        dom.detailsPanel.innerHTML = `
            <div class="detail-card">
                <div class="detail-header">
                    <div class="detail-icon">🏢</div>
                    <div><h2>${lead.customer}</h2><div class="detail-tags">${tagsHtml}</div></div>
                </div>
                <div class="status-toggles">
                    <div class="status-item">${lead.intro ? checkIcon : xIcon} Intro Meeting</div>
                    <div class="status-item">${lead.weekly ? checkIcon : xIcon} Weekly Calls</div>
                </div>
                <div class="section-title">CONTACT INFORMATION</div>
                <div class="info-grid">
                    <div class="info-row"><div class="avatar-placeholder">👤</div><div><div class="info-label">Customer Contact</div><div class="info-value">${lead.contact}</div></div></div>
                    <div class="info-row"><div class="avatar-placeholder">👤</div><div><div class="info-label">Strategic Owner</div><div class="info-value">${lead.strategic}</div></div></div>
                </div>
                <div class="section-title">TEAM ASSIGNMENT</div>
                <div class="info-grid">
                    <div class="info-row"><div class="avatar-placeholder">👥</div><div><div class="info-label">Management Lead</div><div class="info-value">${lead.manager}</div></div></div>
                    <div class="info-row"><div class="avatar-placeholder">🚚</div><div><div class="info-label">Delivery Lead</div><div class="info-value ${lead.delivery ? '' : 'unassigned'}">${lead.delivery || 'Not assigned'}</div></div></div>
                </div>
                <div class="section-title">PIPELINE STATUS</div>
                <div class="pipeline-list">
                    ${pipeRow('PPTs Shared', lead.pipeline.ppts)}
                    ${pipeRow('Verbal Agreement', lead.pipeline.verbal)}
                    ${pipeRow('NDA Signed', lead.pipeline.nda)}
                    ${pipeRow('LOI Issued', lead.pipeline.loi_issued)}
                    ${pipeRow('LOI Signed', lead.pipeline.loi_signed)}
                    ${pipeRow('Contract Signed', lead.pipeline.contract)}
                    ${pipeRow('Parts & Spend Received', lead.pipeline.parts)}
                </div>
                <div class="section-title">NOTES</div>
                <div class="notes-area">
                    <textarea id="notesArea">${lead.notes}</textarea>
                    <button class="btn btn-outline" style="width:100%; justify-content:center; margin-top:8px;" onclick="saveNotes()">Save Notes</button>
                </div>
            </div>
        `;

        window.saveNotes = () => { alert('Notes saved locally'); };
    }

    // --- Events ---
    function setupEventListeners() {
        dom.searchInput.addEventListener('input', applyFiltersAndSort);
        dom.refreshBtn.addEventListener('click', fetchData);
        
        // Listen to select changes
        dom.originSelect.addEventListener('change', applyFiltersAndSort);
        dom.typeSelect.addEventListener('change', applyFiltersAndSort);
        dom.managerSelect.addEventListener('change', applyFiltersAndSort);
        dom.stageSelect.addEventListener('change', applyFiltersAndSort);

        // Sort Buttons
        Object.keys(dom.sortBtns).forEach(key => {
            const btn = dom.sortBtns[key];
            if(btn) {
                btn.addEventListener('click', () => {
                    // Toggle Direction or Change Field
                    if (state.sort.field === (key === 'followup' ? 'score' : key)) {
                        state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.sort.field = (key === 'followup' ? 'score' : key);
                        state.sort.direction = key === 'followup' ? 'desc' : 'asc';
                    }
                    
                    // UI Update
                    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active-sort'));
                    btn.classList.add('active-sort');
                    btn.innerText = key.charAt(0).toUpperCase() + key.slice(1) + (state.sort.direction === 'asc' ? ' ↑' : ' ↓');
                    
                    applyFiltersAndSort();
                });
            }
        });
    }

    function updateTimestamp() {
        dom.lastUpdated.innerText = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
});
