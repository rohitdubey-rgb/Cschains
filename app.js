document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://script.google.com/macros/s/AKfycbyOUM7C6Qh1g_o1wmNXDM0wggHxjAxKj_y7GKPEzfcGy4SRlAiphJMISu1WUE1X2CPfyw/exec';
    
    const state = {
        allLeads: [], filteredLeads: [], selectedLeadId: null,
        dropdowns: { managers: [], strategic: [], delivery: [] },
        sort: { field: 'score', direction: 'desc' }
    };

    const dom = {
        listContainer: document.getElementById('leadsListContainer'),
        detailsPanel: document.getElementById('detailsPanel'),
        searchInput: document.getElementById('searchInput'),
        listCount: document.getElementById('listCount'),
        refreshBtn: document.getElementById('refreshBtn'),
        saveBtn: document.getElementById('globalSaveBtn'),
        addLeadBtn: document.getElementById('addLeadBtn'),
        originSelect: document.getElementById('originSelect'),
        typeSelect: document.getElementById('typeSelect'),
        managerSelect: document.getElementById('managerSelect'),
        stageSelect: document.getElementById('stageSelect'),
        phaseSelect: document.getElementById('phaseFilter'),
        sortBtns: {
            prob: document.getElementById('sortProb'),
            name: document.getElementById('sortName')
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
            dom.phaseSelect = document.getElementById('phaseFilter');
        }
    }

    async function fetchData() {
        try {
            dom.listContainer.innerHTML = '<div class="loading-state">Fetching leads...</div>';
            const response = await fetch(API_URL);
            const data = await response.json();
            state.allLeads = data.map((item, index) => normalizeLead(item, index));
            extractDropdownOptions(); populateFilters(); applyFiltersAndSort();
            if (state.filteredLeads.length > 0 && !state.selectedLeadId) selectLead(state.filteredLeads[0].id);
            else if (state.selectedLeadId) selectLead(state.selectedLeadId);
        } catch (error) { dom.listContainer.innerHTML = '<div class="loading-state" style="color:red">Error loading data.</div>'; }
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
        lead.phase = getPhase(lead.score);
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
                ppts: checkBool('PPTs Shared'), verbal: checkBool('Verbal Agreement'), nda: checkBool('NDA Signed'),
                loi_issued: checkBool('LOI Issued'), loi_signed: checkBool('LOI Signed'),
                contract: checkBool('Contract Signed'), parts: checkBool('Parts & Spend Received')
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
        const phaseVal = dom.phaseSelect.value;
        const typeVal = dom.typeSelect.value;
        const stageVal = dom.stageSelect.value;

        state.filteredLeads = state.allLeads.filter(lead => {
            const matchesSearch = lead.customer.toLowerCase().includes(query) || lead.contact.toLowerCase().includes(query);
            const matchesOrigin = originVal === 'all' || lead.origin === originVal;
            const matchesManager = managerVal === 'all' || lead.manager === managerVal;
            const matchesType = typeVal === 'all' || lead.type === typeVal || lead.type === 'both';
            
            let matchesPhase = true;
            if (phaseVal !== 'all') {
                if (phaseVal === 'p1' && lead.phase !== 1) matchesPhase = false;
                if (phaseVal === 'p2' && lead.phase !== 2) matchesPhase = false;
                if (phaseVal === 'p3' && lead.phase !== 3) matchesPhase = false;
            }

            let matchesStage = true;
            if (stageVal === 'contract' && !lead.pipeline.contract) matchesStage = false;
            if (stageVal === 'loi_signed' && !lead.pipeline.loi_signed) matchesStage = false;
            if (stageVal === 'loi_issued' && !lead.pipeline.loi_issued) matchesStage = false;
            if (stageVal === 'intro' && !lead.intro) matchesStage = false;

            return matchesSearch && matchesOrigin && matchesManager && matchesPhase && matchesStage && matchesType;
        });

        // SORTING
        const { field, direction } = state.sort;
        state.filteredLeads.sort((a, b) => {
            let valA, valB;
            if (field === 'score') { valA = a.score; valB = b.score; } 
            else if (field === 'customer') { valA = a.customer.toLowerCase(); valB = b.customer.toLowerCase(); } 
            
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
            const phase = lead.phase;
            row.className = `lead-row phase-${phase} ${state.selectedLeadId === lead.id ? 'active' : ''}`;
            row.onclick = () => selectLead(lead.id);

            const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
            
            let statusHtml = '';
            if (lead.weekly) statusHtml = `<span class="dot dot-green"></span> Weekly`;
            else if (lead.intro) statusHtml = `<span class="dot dot-green"></span> Intro`;
            else statusHtml = `<span class="dot dot-gray"></span> Prospect`;

            row.innerHTML = `
                <div class="lead-icon-col"><div class="icon-circle">📄</div></div>
                <div class="lead-content-col">
                    <div class="lead-header-row"><span class="lead-name">${lead.customer}</span>${tagsHtml}</div>
                    <div class="lead-notes">${lead.notes}</div>
                </div>
                <div class="lead-meta-col">
                    <div class="status-indicators">${statusHtml}</div>
                    <div style="font-size:0.65rem; color:#9ca3af">Win Prob: ${lead.progress}%</div>
                </div>
            `;
            dom.listContainer.appendChild(row);
        });
    }

    function selectLead(id) { state.selectedLeadId = id; renderList(); renderDetails(state.allLeads.find(l => l.id === id)); }

    function renderDetails(lead) {
        if (!lead) return;
        const phase = lead.phase;
        const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
        const checkIcon = `<svg width="14" height="14" stroke="var(--success)" fill="none" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
        const xIcon = `<svg width="14" height="14" stroke="var(--text-light)" fill="none" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        
        // NEW CARD CREATOR
        const createCard = (icon, label, fieldKey, value, isDropdown, options) => {
            const displayVal = value || 'Unassigned';
            const optionsStr = options ? options.join('|') : '';
            return `
            <div class="team-card">
                <div class="team-icon">${icon}</div>
                <div class="team-info" style="flex:1">
                    <span class="team-label">${label}</span>
                    <div class="editable-field" id="field-${fieldKey}">
                        <span class="team-value ${value ? '' : 'unassigned'}">${displayVal}</span>
                        <span class="edit-icon" onclick="window.enableEdit('${lead.id}', '${fieldKey}', '${value || ''}', ${isDropdown}, '${optionsStr}')">✎</span>
                    </div>
                </div>
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

        // ICONS: Customer (User), Strategic (Target), Manager (Briefcase), Delivery (Truck)
        const iconUser = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        const iconTarget = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;
        const iconBriefcase = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
        const iconTruck = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`;

        dom.detailsPanel.innerHTML = `
            <div class="detail-card phase-${phase}">
                <div class="detail-header-top">
                    <div style="display:flex; align-items:center; gap:20px;">
                        <div onclick="window.editLogo('${lead.id}')">${logoHtml}</div>
                        <div>
                            <h2>${lead.customer} ${linkedInBtn}</h2>
                            <div class="detail-tags" style="margin-top:5px;">${tagsHtml}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        ${slidesBtn}
                        <button class="btn-danger" onclick="window.deleteLead('${lead.id}')" title="Delete">🗑</button>
                    </div>
                </div>

                <div class="progress-section">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-gray);">
                        <span>Win Probability</span>
                        <strong>${lead.progress}%</strong>
                    </div>
                    <div class="progress-container"><div class="progress-fill phase-${phase}" style="width: ${lead.progress}%"></div></div>
                </div>

                <div class="status-toggles">
                    <span class="status-item clickable" onclick="window.toggleTopStatus('${lead.id}', 'weekly')">${lead.weekly ? checkIcon : xIcon} Weekly Calls</span>
                </div>

                <div class="details-split-view">
                    <div class="details-left">
                        <div class="section-title">Team Assignment</div>
                        <div class="team-grid">
                            ${createCard(iconUser, 'Customer Contact', 'contact', lead.contact, false)}
                            ${createCard(iconTarget, 'Strategic Owner', 'strategic', lead.strategic, true, state.dropdowns.strategic)}
                            ${createCard(iconBriefcase, 'Manager Lead', 'manager', lead.manager, true, state.dropdowns.managers)}
                            ${createCard(iconTruck, 'Delivery Lead', 'delivery', lead.delivery, true, state.dropdowns.managers)}
                        </div>

                        <div class="section-title">Pipeline Stages</div>
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

    async function saveLeadData(lead) {
        const btn = dom.saveBtn;
        btn.innerHTML = 'Saving...';
        recalculateScore(lead);
        renderList();
        renderDetails(lead);
        const payload = { ...lead, ...lead.pipeline, action: 'update' };
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            if ((await res.json()).status === 'success') {
                btn.innerHTML = '✔ Saved';
                btn.classList.add('btn-success');
                setTimeout(() => { btn.innerHTML = 'Save Changes'; btn.classList.remove('btn-success'); }, 2000);
            }
        } catch (e) { btn.innerHTML = '✖ Error'; btn.classList.add('btn-error'); }
    }

    dom.addLeadBtn.onclick = async () => {
        const name = prompt("Enter New Customer Name:");
        if (!name) return;
        dom.addLeadBtn.innerHTML = "...";
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'create', customer: name }) });
            if ((await res.json()).status === 'success') { alert("Created!"); fetchData(); }
        } catch(e) { alert("Error"); }
        dom.addLeadBtn.innerHTML = "+ Add Lead";
    };

    window.deleteLead = async (id) => {
        const lead = state.allLeads.find(l => l.id === id);
        if (!confirm(`Delete ${lead.customer}?`)) return;
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', customer: lead.customer }) });
            if ((await res.json()).status === 'success') { alert("Deleted."); fetchData(); }
        } catch(e) { alert("Error"); }
    };

    function setupGlobalFunctions() {
        dom.saveBtn.onclick = () => { if(state.selectedLeadId) saveLeadData(state.allLeads.find(l=>l.id===state.selectedLeadId)); };
        
        dom.phaseSelect.addEventListener('change', applyFiltersAndSort);
        dom.originSelect.addEventListener('change', applyFiltersAndSort);
        dom.typeSelect.addEventListener('change', applyFiltersAndSort);
        dom.managerSelect.addEventListener('change', applyFiltersAndSort);
        dom.stageSelect.addEventListener('change', applyFiltersAndSort);
        dom.searchInput.addEventListener('input', applyFiltersAndSort);
        
        // SORT LOGIC
        dom.sortBtns.prob.addEventListener('click', () => { setSort('score', 'desc'); });
        dom.sortBtns.name.addEventListener('click', () => { setSort('customer', 'asc'); });

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
    }
    
    function setSort(field, dir) {
        state.sort.field = field; state.sort.direction = dir;
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active-sort'));
        if(field === 'score') dom.sortBtns.prob.classList.add('active-sort');
        if(field === 'customer') dom.sortBtns.name.classList.add('active-sort');
        applyFiltersAndSort();
    }
    
    function setupEventListeners() { dom.refreshBtn.addEventListener('click', fetchData); }
    
    function populateFilters() {
        const mgrs = state.dropdowns.managers;
        dom.managerSelect.innerHTML = '<option value="all">All Managers</option>' + mgrs.map(m=>`<option value="${m}">${m}</option>`).join('');
        const origins = [...new Set(state.allLeads.map(l=>l.origin))].filter(Boolean).sort();
        dom.originSelect.innerHTML = '<option value="all">All Origins</option>' + origins.map(o=>`<option value="${o}">${o}</option>`).join('');
    }
    function updateTimestamp() { dom.lastUpdated.innerText = `Updated ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`; }
});
