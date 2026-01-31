document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_URL = 'https://script.google.com/macros/s/AKfycbypx_E-8wEvZc0os8z1ujejISPfTaG3MZHTEUeC2ABpZIKtPit6jJ5GQJxg0Zuy8abDxA/exec';
    
    // --- State ---
    const state = {
        allLeads: [],
        filteredLeads: [],
        selectedLeadId: null,
        sort: { field: 'customer', direction: 'asc' },
        activeFilters: {
            origin: false,
            pim_cm: false,
            manager: false,
            intro: false,
            loi: false
        }
    };

    // --- DOM Elements ---
    const dom = {
        listContainer: document.getElementById('leadsListContainer'),
        detailsPanel: document.getElementById('detailsPanel'),
        searchInput: document.getElementById('searchInput'),
        notesFilter: document.getElementById('notesFilter'),
        listCount: document.getElementById('listCount'),
        totalCount: document.getElementById('totalCount'),
        refreshBtn: document.getElementById('refreshBtn'),
        lastUpdated: document.getElementById('lastUpdated'),
        filterPills: document.querySelectorAll('.pill-btn'),
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
            
            console.log("🔥 Loaded Data:", data); // Check console to see your real column names

            state.allLeads = data.map((item, index) => normalizeLead(item, index));
            
            applyFiltersAndSort();
            updateTimestamp();
            
            if (state.filteredLeads.length > 0) {
                selectLead(state.filteredLeads[0].id);
            }
        } catch (error) {
            console.error('Error:', error);
            dom.listContainer.innerHTML = '<div class="loading-state" style="color:var(--danger)">Connection Error. Try Refresh.</div>';
        }
    }

    // --- Core Logic: Robust Normalization ---
    function normalizeLead(item, index) {
        
        // Helper: Find value by looking for keywords in keys
        const find = (keywords) => {
            const keys = Object.keys(item);
            const foundKey = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
            return foundKey ? item[foundKey] : null;
        };

        // Helper: Check if a specific column exists and is "TRUE"/"YES"
        const checkBool = (keywords) => {
            const val = find(keywords);
            if (!val) return false;
            const str = String(val).toLowerCase();
            return str === 'true' || str === 'yes' || str === 'checked' || val === true;
        };

        // 1. Basic Info
        const company = find(['company', 'customer', 'account', 'name']) || 'Unknown Company';
        const contact = find(['contact', 'person']) || 'Unknown Contact';
        const manager = find(['manager', 'owner', 'lead']) || 'Unassigned';
        const strategic = find(['strategic']) || 'Unassigned';
        const origin = find(['origin', 'source']) || '';
        const stageRaw = (find(['stage', 'status', 'pipeline']) || '').toLowerCase();

        // 2. PIPELINE LOGIC (The Fix)
        // A. Check for specific columns first (e.g. column "NDA Signed" = TRUE)
        let ppts = checkBool(['ppt', 'presentation', 'deck']);
        let verbal = checkBool(['verbal', 'agree']);
        let nda = checkBool(['nda']);
        let loi_issued = checkBool(['loi issued', 'loi sent']);
        let loi_signed = checkBool(['loi signed', 'loi received']);
        let contract = checkBool(['contract', 'msa']);
        let parts = checkBool(['part', 'spend']);

        // B. Check the "Stage" column to fill in gaps
        // If Stage is "LOI Signed", then NDA/Verbal/PPT must logically be done too.
        if (stageRaw.includes('part') || stageRaw.includes('spend')) { 
            ppts=true; verbal=true; nda=true; loi_issued=true; loi_signed=true; contract=true; parts=true; 
        }
        else if (stageRaw.includes('contract')) { 
            ppts=true; verbal=true; nda=true; loi_issued=true; loi_signed=true; contract=true; 
        }
        else if (stageRaw.includes('loi signed')) { 
            ppts=true; verbal=true; nda=true; loi_issued=true; loi_signed=true; 
        }
        else if (stageRaw.includes('loi issued') || stageRaw.includes('loi sent')) { 
            ppts=true; verbal=true; nda=true; loi_issued=true; 
        }
        else if (stageRaw.includes('nda')) { 
            ppts=true; verbal=true; nda=true; 
        }
        else if (stageRaw.includes('verbal')) { 
            ppts=true; verbal=true; 
        }
        else if (stageRaw.includes('ppt') || stageRaw.includes('intro')) { 
            ppts=true; 
        }

        // 3. Notes Cleaning
        // If "notes" column contains a date (ISO format), look for a better column
        let rawNotes = find(['notes', 'next', 'update']) || '';
        if (typeof rawNotes === 'string' && rawNotes.match(/^\d{4}-\d{2}-\d{2}/)) {
            // If the note is just a date, try to find a long string in the object
            const fallback = Object.values(item).find(v => typeof v === 'string' && v.length > 20 && !v.includes(company));
            rawNotes = fallback || "No progress notes";
        }
        if (!rawNotes) rawNotes = "No progress notes";

        // 4. Tags Generation
        const tags = [];
        if (origin) tags.push({ text: origin, type: 'blue' });
        
        // Detect PIM/CM from whole object string
        const allText = JSON.stringify(item).toLowerCase();
        if (allText.includes('pim')) tags.push({ text: 'PIM', type: 'pim' });
        if (allText.includes('cm')) tags.push({ text: 'CM', type: 'cm' });
        
        // Status Tags
        if (stageRaw.includes('loi')) tags.push({ text: 'LOI Issued', type: 'loi' });
        if (allText.includes('past')) tags.push({ text: 'From Past', type: 'past' });

        // 5. Dates & Meta
        let dateObj = new Date();
        const rawDate = find(['date', 'modified', 'updated']);
        if (rawDate) dateObj = new Date(rawDate);

        return {
            id: `lead-${index}`,
            customer: company,
            contact: contact,
            manager: manager,
            strategic: strategic,
            notes: rawNotes,
            tags: tags,
            origin: origin,
            stageRaw: stageRaw,
            date: dateObj,
            displayDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            intro: checkBool(['intro']) || stageRaw.includes('intro'),
            weekly: checkBool(['weekly', 'call']),
            pipeline: {
                ppts, verbal, nda, loi_issued, loi_signed, contract, parts
            }
        };
    }

    // --- Filtering & Sorting ---
    function applyFiltersAndSort() {
        const query = dom.searchInput.value.toLowerCase();
        const noteQuery = dom.notesFilter.value.toLowerCase();

        state.filteredLeads = state.allLeads.filter(lead => {
            const matchesSearch = 
                lead.customer.toLowerCase().includes(query) || 
                lead.contact.toLowerCase().includes(query) ||
                lead.manager.toLowerCase().includes(query);
            
            const matchesNotes = lead.notes.toLowerCase().includes(noteQuery);

            let matchesPills = true;
            if (state.activeFilters.origin && !lead.origin) matchesPills = false;
            if (state.activeFilters.pim_cm && !lead.tags.some(t => t.type === 'pim' || t.type === 'cm')) matchesPills = false;
            if (state.activeFilters.intro && !lead.intro) matchesPills = false;
            if (state.activeFilters.loi && !lead.stageRaw.includes('loi')) matchesPills = false;
            if (state.activeFilters.manager && (lead.manager === 'Unassigned' || !lead.manager)) matchesPills = false;

            return matchesSearch && matchesNotes && matchesPills;
        });

        const { field, direction } = state.sort;
        state.filteredLeads.sort((a, b) => {
            let valA, valB;
            if (field === 'customer') { valA = a.customer.toLowerCase(); valB = b.customer.toLowerCase(); }
            else if (field === 'origin') { valA = a.origin.toLowerCase(); valB = b.origin.toLowerCase(); }
            else if (field === 'manager') { valA = a.manager.toLowerCase(); valB = b.manager.toLowerCase(); }
            else if (field === 'followup') { valA = a.date; valB = b.date; }
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
            dom.listContainer.innerHTML = '<div class="empty-state">No leads found.</div>';
            return;
        }

        state.filteredLeads.forEach(lead => {
            const row = document.createElement('div');
            row.className = `lead-row ${state.selectedLeadId === lead.id ? 'active' : ''}`;
            row.onclick = () => selectLead(lead.id);

            const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
            const introClass = lead.intro ? 'dot-green' : 'dot-gray';
            const weeklyClass = lead.weekly ? 'dot-green' : 'dot-gray';

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
                    <div>${lead.displayDate}</div>
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
                    <div class="info-row"><div class="avatar-placeholder">🚚</div><div><div class="info-label">Delivery Lead</div><div class="info-value unassigned">Not assigned</div></div></div>
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
                    <button class="btn" style="background:var(--primary); color:white; width:100%; justify-content:center; margin-top:8px;" onclick="saveNotes('${lead.id}')">Save Notes</button>
                </div>
            </div>
        `;

        window.saveNotes = (id) => {
            const val = document.getElementById('notesArea').value;
            const target = state.allLeads.find(l => l.id === id);
            if(target) target.notes = val;
            renderList();
            alert('Notes saved locally');
        };
    }

    // --- Events ---
    function setupEventListeners() {
        dom.searchInput.addEventListener('input', applyFiltersAndSort);
        dom.notesFilter.addEventListener('input', applyFiltersAndSort);
        dom.refreshBtn.addEventListener('click', fetchData);

        dom.filterPills.forEach(btn => {
            btn.addEventListener('click', () => {
                const filterKey = btn.dataset.filter;
                state.activeFilters[filterKey] = !state.activeFilters[filterKey];
                btn.classList.toggle('active', state.activeFilters[filterKey]);
                applyFiltersAndSort();
            });
        });

        Object.keys(dom.sortBtns).forEach(key => {
            const btn = dom.sortBtns[key];
            if(btn) {
                btn.addEventListener('click', () => {
                    if (state.sort.field === key) {
                        state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.sort.field = key;
                        state.sort.direction = 'asc';
                    }
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
