document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://script.google.com/macros/s/AKfycbyOUM7C6Qh1g_o1wmNXDM0wggHxjAxKj_y7GKPEzfcGy4SRlAiphJMISu1WUE1X2CPfyw/exec';
    
    const state = {
        allLeads: [],
        filteredLeads: [],
        selectedLeadId: null,
        dropdowns: { managers: [], strategic: [], delivery: [] },
        sort: { field: 'score', direction: 'desc' }
    };

    const dom = {
        listContainer: document.getElementById('leadsListContainer'),
        detailsPanel: document.getElementById('detailsPanel'),
        searchInput: document.getElementById('searchInput'),
        listCount: document.getElementById('listCount'),
        totalCount: document.getElementById('totalCount'),
        refreshBtn: document.getElementById('refreshBtn'),
        saveBtn: document.getElementById('globalSaveBtn'),
        addLeadBtn: document.getElementById('addLeadBtn'),
        lastUpdated: document.getElementById('lastUpdated'),
        originSelect: document.getElementById('originSelect'),
        typeSelect: document.getElementById('typeSelect'),
        managerSelect: document.getElementById('managerSelect'),
        stageSelect: document.getElementById('stageSelect'),
        phaseSelect: null,
        sortBtns: {
            customer: document.getElementById('sortCustomer'),
            origin: document.getElementById('sortOrigin'),
            manager: document.getElementById('sortManager'),
            followup: document.getElementById('sortFollowup')
        }
    };

    init();

    function init() {
        createPhaseFilter();
        fetchData();
        setupEventListeners();
        setupGlobalFunctions();
    }

    function createPhaseFilter() {
        const filterRow = document.querySelector('.filter-row');
        if (filterRow && !document.getElementById('phaseFilter')) {
            const select = document.createElement('select');
            select.id = 'phaseFilter';
            select.className = 'filter-select';
            select.innerHTML = `<option value="all">All Phases</option><option value="p1">Phase 1: Exploration</option><option value="p2">Phase 2: Validation</option><option value="p3">Phase 3: Execution</option>`;
            filterRow.insertBefore(select, filterRow.firstChild);
            dom.phaseSelect = select;
        }
    }

    async function fetchData() {
        try {
            dom.listContainer.innerHTML = '<div class="loading-state">Fetching leads...</div>';
            const response = await fetch(API_URL);
            const data = await response.json();
            state.allLeads = data.map((item, index) => normalizeLead(item, index));
            extractDropdownOptions();
            populateFilters();
            applyFiltersAndSort();
            updateTimestamp();
            if (state.filteredLeads.length > 0 && !state.selectedLeadId) selectLead(state.filteredLeads[0].id);
            else if (state.selectedLeadId) selectLead(state.selectedLeadId); // Refresh current selection
        } catch (error) {
            console.error(error);
            dom.listContainer.innerHTML = '<div class="loading-state" style="color:red">Error loading data.</div>';
        }
    }

    function extractDropdownOptions() {
        const getUnique = (key) => [...new Set(state.allLeads.map(l => l[key]))].filter(x => x && x !== 'Unassigned').sort();
        state.dropdowns.managers = getUnique('manager');
        state.dropdowns.strategic = getUnique('strategic');
        state.dropdowns.delivery = getUnique('delivery');
    }

    function recalculateScore(lead) {
        let score = 0;
        if (lead.intro) score += 10;
        if (lead.weekly) score += 5;
        if (lead.pipeline.ppts) score += 10;
        if (lead.pipeline.verbal) score += 15;
        if (lead.pipeline.nda) score += 10;
        if (lead.pipeline.loi_issued) score += 20;
        if (lead.pipeline.loi_signed) score += 30;
        if (lead.pipeline.contract) score += 50;
        if (lead.pipeline.parts) score += 10;
        lead.score = score;
        lead.progress = Math.min(100, Math.round((score / 160) * 100));
    }

    function getPhase(score) {
        if (score <= 35) return 1;
        if (score <= 70) return 2;
        return 3;
    }

    function normalizeLead(item, index) {
        const getValue = (targetName) => {
            const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, "");
            const keys = Object.keys(item);
            const foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanTarget);
            return foundKey ? item[foundKey] : "";
        };
        const checkBool = (targetName) => {
            const val = getValue(targetName);
            const str = String(val).toLowerCase().trim();
            return val === true || str === 'true' || str === 'yes' || str === 'checked';
        };

        const lead = {
            id: `lead-${index}`,
            customer: getValue('Customer') || getValue('Company') || 'Unknown',
            logo: getValue('Logo URL') || getValue('Logo') || '',
            linkedin: getValue('LinkedIn') || getValue('Social') || '',
            slides: getValue('Slides URL') || getValue('Slides') || '',
            contact: getValue('Customer Point of Contact') || 'Unknown',
            manager: getValue('Management Lead') || getValue('Manager') || 'Unassigned',
            strategic: getValue('Strategic Owner') || 'Unassigned',
            delivery: getValue('Delivery Lead') || 'Unassigned',
            origin: getValue('Lead Origin') || '',
            notes: getValue('Notes') || "No notes",
            intro: checkBool('Introductory Meeting') || checkBool('Intro'),
            weekly: checkBool('Weekly Calls'),
            pipeline: {
                ppts: checkBool('PPTs Shared'),
                verbal: checkBool('Verbal Agreement'),
                nda: checkBool('NDA Signed'),
                loi_issued: checkBool('LOI Issued'),
                loi_signed: checkBool('LOI Signed'),
                contract: checkBool('Contract Signed'),
                parts: checkBool('Parts & Spend Received')
            },
            tags: []
        };
        if (lead.origin) lead.tags.push({ text: lead.origin, type: 'blue' });
        const typeStr = String(getValue('PIM or CM')).toLowerCase();
        if (typeStr.includes('both')) lead.tags.push({ text: 'BOTH', type: 'both' });
        else if (typeStr.includes('pim')) lead.tags.push({ text: 'PIM', type: 'pim' });
        else if (typeStr.includes('cm')) lead.tags.push({ text: 'CM', type: 'cm' });
        if (lead.pipeline.loi_issued) lead.tags.push({ text: 'LOI Issued', type: 'loi' });

        recalculateScore(lead);
        return lead;
    }

    function applyFiltersAndSort() {
        const query = dom.searchInput.value.toLowerCase();
        const originVal = dom.originSelect.value;
        const managerVal = dom.managerSelect.value;
        const phaseVal = dom.phaseSelect ? dom.phaseSelect.value : 'all';

        state.filteredLeads = state.allLeads.filter(lead => {
            const matchesSearch = lead.customer.toLowerCase().includes(query) || lead.contact.toLowerCase().includes(query);
            const matchesOrigin = originVal === 'all' || lead.origin === originVal;
            const matchesManager = managerVal === 'all' || lead.manager === managerVal;
            let matchesPhase = true;
            if (phaseVal !== 'all') {
                const phase = getPhase(lead.score);
                if (phaseVal === 'p1' && phase !== 1) matchesPhase = false;
                if (phaseVal === 'p2' && phase !== 2) matchesPhase = false;
                if (phaseVal === 'p3' && phase !== 3) matchesPhase = false;
            }
            return matchesSearch && matchesOrigin && matchesManager && matchesPhase;
        });

        const { field, direction } = state.sort;
        state.filteredLeads.sort((a, b) => {
            let valA = field === 'score' ? a.score : a[field].toLowerCase();
            let valB = field === 'score' ? b.score : b[field].toLowerCase();
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        renderList();
    }

    function renderList() {
        dom.listContainer.innerHTML = '';
        dom.listCount.innerText = state.filteredLeads.length;
        if (state.filteredLeads.length === 0) { dom.listContainer.innerHTML = '<div class="empty-state">No leads match.</div>'; return; }

        state.filteredLeads.forEach(lead => {
            const row = document.createElement('div');
            const phase = getPhase(lead.score);
            row.className = `lead-row phase-${phase} ${state.selectedLeadId === lead.id ? 'active' : ''}`;
            row.onclick = () => selectLead(lead.id);

            const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
            
            // FIX: Show correct status text based on boolean
            let statusHtml = '';
            if (lead.weekly) statusHtml = `<span class="dot dot-green"></span> Weekly`;
            else if (lead.intro) statusHtml = `<span class="dot dot-green"></span> Intro`;
            else statusHtml = `<span class="dot dot-gray"></span> Pending`;

            row.innerHTML = `
                <div class="lead-icon-col"><div class="icon-circle">📄</div></div>
                <div class="lead-content-col">
                    <div class="lead-header-row"><span class="lead-name">${lead.customer}</span>${tagsHtml}</div>
                    <div class="lead-notes">${lead.notes}</div>
                </div>
                <div class="lead-meta-col">
                    <div class="status-indicators"><div class="status-dot">${statusHtml}</div></div>
                    <div style="font-size:0.65rem; color:#9ca3af">Win Prob: ${lead.progress}%</div>
                </div>
            `;
            dom.listContainer.appendChild(row);
        });
    }

    function selectLead(id) { state.selectedLeadId = id; renderList(); renderDetails(state.allLeads.find(l => l.id === id)); }

    function renderDetails(lead) {
        if (!lead) return;
        const phase = getPhase(lead.score);
        const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
        const checkIcon = `<svg width="14" height="14" stroke="var(--success)" fill="none" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
        const xIcon = `<svg width="14" height="14" stroke="var(--text-light)" fill="none" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        
        const createEditable = (fieldKey, value, isDropdown, options) => {
            const displayVal = value || 'Unassigned';
            const optionsStr = options ? options.join('|') : '';
            return `<div class="editable-field" id="field-${fieldKey}">
                <span class="info-value ${value ? '' : 'unassigned'}">${displayVal}</span>
                <span class="edit-icon" onclick="window.enableEdit('${lead.id}', '${fieldKey}', '${value || ''}', ${isDropdown}, '${optionsStr}')">✎</span>
            </div>`;
        };

        const createPipeRow = (label, key, val) => `
            <div class="pipeline-item clickable" onclick="window.togglePipeline('${lead.id}', '${key}')">
                <span>${label}</span>
                <span class="${val ? 'status-text-yes' : 'status-text-no'}">${val ? 'Yes' : 'No'}</span>
            </div>
        `;

        const logoHtml = lead.logo ? `<img src="${lead.logo}" class="company-logo">` : `<div class="logo-placeholder">${lead.customer.charAt(0)}</div>`;
        const slidesBtn = lead.slides ? `<a href="${lead.slides}" target="_blank" class="btn-slides">Slides</a>` : `<button class="btn-outline" onclick="window.editSlides('${lead.id}')">+ Slides</button>`;
        const linkedInBtn = lead.linkedin ? `<a href="${lead.linkedin}" target="_blank" class="icon-btn-link"><svg width="14" height="14" fill="#0077b5" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></a>` : '';

        // Added DELETE button in header
        dom.detailsPanel.innerHTML = `
            <div class="detail-card phase-${phase}">
                <div class="detail-header-top">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div onclick="window.editLogo('${lead.id}')" style="cursor:pointer">${logoHtml}</div>
                        <div>
                            <h2>${lead.customer}</h2>
                            <div class="detail-tags">${tagsHtml}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        ${slidesBtn}
                        <button class="btn-danger" onclick="window.deleteLead('${lead.id}')" title="Delete Customer">🗑</button>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-gray);">
                    <span>Progress: ${lead.progress}%</span>
                </div>
                <div class="progress-container"><div class="progress-fill phase-${phase}" style="width: ${lead.progress}%"></div></div>

                <div class="status-toggles">
                    <span class="status-item clickable" onclick="window.toggleTopStatus('${lead.id}', 'intro')">${lead.intro ? checkIcon : xIcon} Intro</span>
                    <span class="status-item clickable" onclick="window.toggleTopStatus('${lead.id}', 'weekly')">${lead.weekly ? checkIcon : xIcon} Weekly</span>
                </div>

                <div class="details-split-view">
                    <div class="details-left">
                        <div class="section-title">Contact Information</div>
                        <div class="info-grid">
                            <div class="info-row"><div class="avatar-placeholder">C</div><div class="info-text"><span class="info-label">Contact</span> <div style="display:flex">${createEditable('contact', lead.contact, false)} ${linkedInBtn}</div></div></div>
                            <div class="info-row"><div class="avatar-placeholder">S</div><div class="info-text"><span class="info-label">Strategy</span> ${createEditable('strategic', lead.strategic, true, state.dropdowns.strategic)}</div></div>
                        </div>

                        <div class="section-title">Team Assignment</div>
                        <div class="info-grid">
                            <div class="info-row"><div class="avatar-placeholder">M</div><div class="info-text"><span class="info-label">Manager</span> ${createEditable('manager', lead.manager, true, state.dropdowns.managers)}</div></div>
                            <div class="info-row"><div class="avatar-placeholder">D</div><div class="info-text"><span class="info-label">Delivery</span> ${createEditable('delivery', lead.delivery, true, state.dropdowns.managers)}</div></div>
                        </div>

                        <div class="section-title">Pipeline</div>
                        <div class="pipeline-list">
                            <div class="phase-header p1">Phase 1: Exploration</div>
                            ${createPipeRow('PPTs Shared', 'ppts', lead.pipeline.ppts)}
                            ${createPipeRow('Verbal Agreement', 'verbal', lead.pipeline.verbal)}
                            <div class="phase-header p2">Phase 2: Validation</div>
                            ${createPipeRow('NDA Signed', 'nda', lead.pipeline.nda)}
                            ${createPipeRow('LOI Issued', 'loi_issued', lead.pipeline.loi_issued)}
                            <div class="phase-header p3">Phase 3: Execution</div>
                            ${createPipeRow('Contract Signed', 'contract', lead.pipeline.contract)}
                            ${createPipeRow('Parts Received', 'parts', lead.pipeline.parts)}
                        </div>
                    </div>

                    <div class="details-right">
                        <div class="section-title">Next Steps & Notes</div>
                        <div class="notes-area">
                            <textarea id="notesArea">${lead.notes}</textarea>
                            <button class="btn-primary" onclick="window.saveNotes()">Save Note</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- API ACTIONS ---
    async function saveLeadData(lead) {
        const btn = dom.saveBtn;
        btn.innerHTML = 'Saving...';
        recalculateScore(lead);
        renderList();
        renderDetails(lead);
        const payload = { ...lead, ...lead.pipeline, action: 'update' };
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await res.json();
            if (result.status === 'success') {
                btn.innerHTML = '✔ Saved';
                btn.classList.add('btn-success');
                setTimeout(() => { btn.innerHTML = 'Save Changes'; btn.classList.remove('btn-success'); }, 2000);
            }
        } catch (e) { btn.innerHTML = '✖ Error'; btn.classList.add('btn-error'); }
    }

    // --- NEW: ADD LEAD ---
    dom.addLeadBtn.onclick = async () => {
        const name = prompt("Enter New Customer Name:");
        if (!name) return;
        dom.addLeadBtn.innerHTML = "Creating...";
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'create', customer: name }) });
            const result = await res.json();
            if (result.status === 'success') {
                alert("Customer Created!");
                fetchData(); // Reload
            } else {
                alert("Error: " + result.message);
            }
        } catch(e) { alert("Network Error"); }
        dom.addLeadBtn.innerHTML = "+ Add Lead";
    };

    // --- NEW: DELETE LEAD ---
    window.deleteLead = async (id) => {
        const lead = state.allLeads.find(l => l.id === id);
        if (!confirm(`Are you sure you want to DELETE ${lead.customer}? This cannot be undone.`)) return;
        
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', customer: lead.customer }) });
            const result = await res.json();
            if (result.status === 'success') {
                alert("Deleted.");
                fetchData(); // Reload
            } else {
                alert("Error: " + result.message);
            }
        } catch(e) { alert("Network Error"); }
    };

    function setupGlobalFunctions() {
        dom.saveBtn.onclick = () => { if(state.selectedLeadId) saveLeadData(state.allLeads.find(l=>l.id===state.selectedLeadId)); };
        dom.phaseSelect.addEventListener('change', applyFiltersAndSort);
        dom.searchInput.addEventListener('input', applyFiltersAndSort);
        dom.originSelect.addEventListener('change', applyFiltersAndSort);
        dom.managerSelect.addEventListener('change', applyFiltersAndSort);
        
        window.togglePipeline = (id, key) => { const l = state.allLeads.find(x=>x.id===id); if(l){ l.pipeline[key]=!l.pipeline[key]; saveLeadData(l); }};
        window.toggleTopStatus = (id, key) => { const l = state.allLeads.find(x=>x.id===id); if(l){ l[key]=!l[key]; saveLeadData(l); }};
        window.saveNotes = () => { const l = state.allLeads.find(x=>x.id===state.selectedLeadId); if(l){ l.notes = document.getElementById('notesArea').value; saveLeadData(l); }};
        
        window.enableEdit = (id, field, val, isDropdown, opts) => {
            const container = document.getElementById(`field-${field}`);
            if (isDropdown) {
                const options = opts.split('|').map(o=>`<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
                container.innerHTML = `<select class="edit-input" id="input-${field}" onblur="window.finishEdit('${id}','${field}')">${options}<option value="Unassigned">Unassigned</option></select>`;
            } else {
                container.innerHTML = `<input class="edit-input" id="input-${field}" value="${val}" onblur="window.finishEdit('${id}','${field}')" onkeydown="if(event.key==='Enter') window.finishEdit('${id}','${field}')">`;
            }
            setTimeout(() => document.getElementById(`input-${field}`).focus(), 50);
        };

        window.finishEdit = (id, field) => {
            const el = document.getElementById(`input-${field}`);
            if (el) { const l = state.allLeads.find(x=>x.id===id); l[field] = el.value; saveLeadData(l); }
        };
        window.editLogo = (id) => { const l = state.allLeads.find(x=>x.id===id); const u = prompt("Logo URL:", l.logo); if(u!==null){ l.logo=u; saveLeadData(l); }};
        window.editSlides = (id) => { const l = state.allLeads.find(x=>x.id===id); const u = prompt("Slides URL:", l.slides); if(u!==null){ l.slides=u; saveLeadData(l); }};
        window.editLinkedIn = (id) => { const l = state.allLeads.find(x=>x.id===id); const u = prompt("LinkedIn URL:", l.linkedin); if(u!==null){ l.linkedin=u; saveLeadData(l); }};
    }
    
    function setupEventListeners() {
        dom.refreshBtn.addEventListener('click', fetchData);
        Object.keys(dom.sortBtns).forEach(k => dom.sortBtns[k].addEventListener('click', () => {
             state.sort.field = (k==='followup'?'score':k); 
             state.sort.direction = state.sort.direction==='asc'?'desc':'asc'; 
             applyFiltersAndSort(); 
        }));
    }
    function populateFilters() {
        const mgrs = state.dropdowns.managers;
        dom.managerSelect.innerHTML = '<option value="all">All Managers</option>' + mgrs.map(m=>`<option value="${m}">${m}</option>`).join('');
        const origins = [...new Set(state.allLeads.map(l=>l.origin))].filter(Boolean).sort();
        dom.originSelect.innerHTML = '<option value="all">All Origins</option>' + origins.map(o=>`<option value="${o}">${o}</option>`).join('');
    }
    function updateTimestamp() { dom.lastUpdated.innerText = `Updated ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`; }
});
