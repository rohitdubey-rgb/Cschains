document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // CONFIGURATION
    // -------------------------------------------------------------
    const API_URL = 'https://script.google.com/macros/s/AKfycbxhnR3cHJsMhAD57Pz8xGdSjw26ER4XQEwl_2eWE4kWyKnw_JaWJWcJrsQRUM-PusBPsQ/exec';
    
    // STATE
    const state = {
        allLeads: [],
        filteredLeads: [],
        selectedLeadId: null,
        dropdowns: { managers: [], strategic: [], delivery: [] },
        sort: { field: 'score', direction: 'desc' }
    };

    // DOM ELEMENTS
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
        sortBtns: { prob: document.getElementById('sortProb'), name: document.getElementById('sortName') }
    };

    // INITIALIZE
    init();

    function init() {
        createPhaseFilter();
        fetchData();
        setupEventListeners();
        setupGlobalFunctions(); // IMPORTANT: This fixes button clicks
    }

    function createPhaseFilter() {
        const filterRow = document.querySelector('.filter-row');
        if (filterRow && !document.getElementById('phaseFilter')) {
            dom.phaseSelect = document.getElementById('phaseFilter');
        }
    }

    // --- DATA FETCHING ---
    async function fetchData() {
        try {
            dom.listContainer.innerHTML = '<div class="loading-state"><span>🔄</span><span>Loading Pipeline...</span></div>';
            const response = await fetch(API_URL);
            const data = await response.json();
            
            state.allLeads = data.map((item, index) => normalizeLead(item, index));
            extractDropdownOptions();
            populateFilters();
            applyFiltersAndSort();
            
            // Restore selection if possible, else pick first
            if (state.selectedLeadId && state.filteredLeads.find(l => l.id === state.selectedLeadId)) {
                // Just update details, don't re-render list
                updateListHighlight(state.selectedLeadId);
                renderDetails(state.allLeads.find(l => l.id === state.selectedLeadId));
            } else if (state.filteredLeads.length > 0) {
                selectLead(state.filteredLeads[0].id);
            } else {
                dom.detailsPanel.innerHTML = '<div class="empty-state">No leads found.</div>';
            }

        } catch (error) {
            console.error(error);
            dom.listContainer.innerHTML = '<div class="empty-state">⚠️ Error loading data.</div>';
        }
    }

    function extractDropdownOptions() {
        const getUnique = (key) => [...new Set(state.allLeads.map(l => l[key]))].filter(x => x && x !== 'Unassigned').sort();
        state.dropdowns.managers = getUnique('manager');
        state.dropdowns.strategic = getUnique('strategic');
        state.dropdowns.delivery = getUnique('delivery');
    }

    // --- LOGIC ---
    function recalculateScore(lead) {
        let score = 0;
        if (lead.dead) { lead.score=0; lead.progress=0; lead.phase=0; return; }
        if (lead.successful) { lead.score=160; lead.progress=100; lead.phase=3; return; }
        
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
        lead.phase = (score <= 35) ? 1 : (score <= 70) ? 2 : 3;
    }

    function normalizeLead(item, index) {
        const getValue = (targetName) => {
            const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, "");
            const keys = Object.keys(item);
            const foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanTarget);
            return foundKey ? item[foundKey] : "";
        };
        const checkBool = (key) => { const v = getValue(key); const s = String(v).toLowerCase().trim(); return v === true || s === 'true' || s === 'yes' || s === 'checked'; };

        const lead = {
            id: `lead-${index}`,
            customer: getValue('Customer') || getValue('Company') || 'Unknown',
            dead: checkBool('Dead') || checkBool('Inactive'),
            successful: checkBool('Successful') || checkBool('Client'),
            logo: getValue('Logo URL') || getValue('Logo') || '',
            linkedin: getValue('LinkedIn') || getValue('Social') || '',
            slides: getValue('Slides URL') || getValue('Slides') || '',
            contact: getValue('Customer Point of Contact') || 'Unknown',
            manager: getValue('Management Lead') || getValue('Manager') || 'Unassigned',
            strategic: getValue('Strategic Owner') || 'Unassigned',
            delivery: getValue('Delivery Lead') || 'Unassigned',
            origin: getValue('Lead Origin') || '',
            notes: getValue('Current Progress') || getValue('Notes') || "",
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

        recalculateScore(lead);
        return lead;
    }

    // --- NOTES UTILITIES ---
    const NOTE_COLORS = [
        { bg: '#eff6ff', border: '#93c5fd', accent: '#2563eb' },
        { bg: '#faf5ff', border: '#ddd6fe', accent: '#7c3aed' },
        { bg: '#fff7ed', border: '#fed7aa', accent: '#ea580c' },
        { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a' },
        { bg: '#fdf4ff', border: '#f0abfc', accent: '#a21caf' },
    ];

    function parseNotes(notesStr) {
        if (!notesStr) return [];
        if (notesStr.includes('|||')) {
            return notesStr.split('\n===\n').map(entry => {
                const sepIdx = entry.indexOf('|||');
                if (sepIdx === -1) return null;
                const dateStr = entry.substring(0, sepIdx);
                const content = entry.substring(sepIdx + 3);
                return { date: new Date(dateStr), content };
            }).filter(Boolean);
        }
        // Legacy plain text — treat as a single undated entry
        return [{ date: null, content: notesStr }];
    }

    function serializeNotes(notes) {
        return notes.map(n => `${n.date.toISOString()}|||${n.content}`).join('\n===\n');
    }

    function formatNoteDate(date) {
        if (!date) return 'Legacy Note';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function formatNoteContent(raw) {
        return raw
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/^---$/gm, '<hr class="note-hr">')
            .replace(/^[•\-] (.+)$/gm, '<div class="note-bullet"><span>•</span><span>$1</span></div>')
            .replace(/\n/g, '<br>');
    }

    // --- FILTERING ---
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
            const baseFilters = matchesSearch && matchesOrigin && matchesManager && matchesType;

            // Dead and successful leads bypass phase/stage filters
            if (lead.dead || lead.successful) return baseFilters;

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

            return baseFilters && matchesPhase && matchesStage;
        });

        const { field, direction } = state.sort;
        state.filteredLeads.sort((a, b) => {
            let valA, valB;
            if (field === 'score') { valA = a.score; valB = b.score; } 
            else { valA = a.customer.toLowerCase(); valB = b.customer.toLowerCase(); } 
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        renderList();
    }

    function renderList() {
        dom.listContainer.innerHTML = '';
        const activeLeads = state.filteredLeads.filter(l => !l.dead && !l.successful);
        const successfulLeads = state.filteredLeads.filter(l => l.successful);
        const deadLeads = state.filteredLeads.filter(l => l.dead);
        const total = activeLeads.length + successfulLeads.length + deadLeads.length;
        dom.listCount.innerText = total;
        if (total === 0) { dom.listContainer.innerHTML = '<div class="empty-state">No leads match.</div>'; return; }

        let globalIdx = 0;
        const renderSection = (leads, title) => {
            if (leads.length === 0) return;
            const header = document.createElement('div');
            header.className = 'list-section-header';
            header.textContent = `${title} (${leads.length})`;
            dom.listContainer.appendChild(header);

            leads.forEach(lead => {
                const row = document.createElement('div');
                let statusClass, iconContent, probBadge;
                if (lead.successful) {
                    statusClass = 'is-successful';
                    iconContent = '✓';
                    probBadge = `<span class="win-prob" style="background:#dcfce7; color:#16a34a; font-weight:800">CLIENT</span>`;
                } else if (lead.dead) {
                    statusClass = 'is-dead';
                    iconContent = '✕';
                    probBadge = `<span class="win-prob" style="background:#334155; color:white">DEAD</span>`;
                } else {
                    statusClass = `phase-${lead.phase}`;
                    iconContent = lead.phase === 3 ? '★' : '📄';
                    probBadge = `<span class="win-prob">${lead.progress}%</span>`;
                }

                row.id = `row-${lead.id}`;
                row.className = `lead-row ${statusClass} ${state.selectedLeadId === lead.id ? 'active' : ''}`;
                row.style.animationDelay = `${globalIdx * 0.05}s`;
                row.onclick = () => selectLead(lead.id);
                globalIdx++;

                const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
                row.innerHTML = `
                    <div class="lead-icon-col"><div class="icon-circle">${iconContent}</div></div>
                    <div class="lead-content-col">
                        <div class="lead-name">${lead.customer} ${tagsHtml}</div>
                        <div class="lead-notes">${lead.notes || 'No progress notes'}</div>
                    </div>
                    <div class="lead-meta-col">${probBadge}</div>
                `;
                dom.listContainer.appendChild(row);
            });
        };

        renderSection(activeLeads, 'Active');
        renderSection(successfulLeads, 'Successful');
        renderSection(deadLeads, 'Re-try');
    }

    // --- OPTIMIZED SELECTION (NO REFRESH) ---
    function selectLead(id) {
        state.selectedLeadId = id;
        updateListHighlight(id);
        renderDetails(state.allLeads.find(l => l.id === id));
    }

    function updateListHighlight(id) {
        // Remove active from all
        document.querySelectorAll('.lead-row').forEach(r => r.classList.remove('active'));
        // Add active to current
        const row = document.getElementById(`row-${id}`);
        if (row) row.classList.add('active');
    }

    function renderDetails(lead) {
        if (!lead) return;
        const phase = lead.phase;
        
        // ICONS
        const iconUser = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        const iconTarget = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;
        const iconBriefcase = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
        const iconTruck = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`;
        const iconLink = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;

        // LOGIC FOR BUTTONS
        const logoHtml = lead.logo ? `<img src="${lead.logo}" class="company-logo">` : `<div class="logo-placeholder">${lead.customer.charAt(0)}</div>`;
        const slidesBtn = lead.slides 
            ? `<div style="display:flex;align-items:center;gap:5px"><a href="${lead.slides}" target="_blank" class="btn-slides">Open Slides</a><span class="edit-btn-mini" onclick="window.editSlides('${lead.id}')">✏️</span></div>` 
            : `<button class="btn-outline" style="height:28px" onclick="window.editSlides('${lead.id}')">+ Slides</button>`;
        const linkedinBtn = lead.linkedin 
            ? `<a href="${lead.linkedin}" target="_blank" style="color:#0077b5; margin-left:5px;">${iconLink}</a>`
            : `<span style="cursor:pointer; opacity:0.3; margin-left:5px;" onclick="window.editLinkedIn('${lead.id}')">+</span>`;

        // GENERATORS
        const createTeamCard = (icon, role, fieldKey, val, isDrop, opts) => `
            <div class="team-card">
                <div class="team-icon-box">${icon}</div>
                <div class="team-info">
                    <div style="display:flex; justify-content:space-between">
                        <span class="team-role">${role}</span>
                        ${fieldKey==='contact' ? linkedinBtn : ''}
                    </div>
                    <div style="display:flex; align-items:center;">
                        <span class="team-name ${val?'':'unassigned'}">${val||'Unassigned'}</span>
                        <span class="edit-btn-mini" onclick="window.enableEdit('${lead.id}', '${fieldKey}', '${val||''}', ${isDrop}, '${opts.join('|')}')">✎</span>
                        <div id="field-${fieldKey}" style="display:none"></div>
                    </div>
                </div>
            </div>`;

        const createPipelineRow = (label, key, val) => `
            <div class="pipeline-row" onclick="window.togglePipeline('${lead.id}', '${key}')">
                <span>${label}</span>
                <span class="badge ${val ? 'yes' : 'no'}">${val ? 'Complete' : 'Pending'}</span>
            </div>`;

        let footerBtns;
        if (lead.successful) {
            footerBtns = `<button class="btn-block-revive" style="flex:1" onclick="window.toggleSuccessful('${lead.id}')">↩ Move to Active</button>`;
        } else if (lead.dead) {
            footerBtns = `<button class="btn-block-revive" style="flex:1" onclick="window.toggleDead('${lead.id}')">♻️ Revive Project</button>`;
        } else {
            footerBtns = `
                <button class="btn-block-success" style="flex:1" onclick="window.toggleSuccessful('${lead.id}')">✓ Mark as Successful</button>
                <button class="btn-danger btn-block-danger" style="flex:1" onclick="window.toggleDead('${lead.id}')">✕ Mark as Dead</button>
            `;
        }

        // RENDER DETAILS HTML
        dom.detailsPanel.innerHTML = `
            <div class="detail-card phase-${phase} ${lead.dead ? 'is-dead' : ''}">
                <div class="detail-header-top">
                    <div style="display:flex; align-items:center; gap:20px;">
                        <div onclick="window.editLogo('${lead.id}')">${logoHtml}</div>
                        <div class="customer-title">
                            <h2>${lead.customer}</h2>
                            <div class="detail-tags">${lead.tags.map(t=>`<span class="tag tag-${t.type}">${t.text}</span>`).join('')}</div>
                        </div>
                    </div>
                    <div>${slidesBtn}</div>
                </div>

                <div class="progress-section">
                    <div class="progress-header">
                        <span>Win Probability</span>
                        <span>${lead.progress}%</span>
                    </div>
                    <div class="progress-bg"><div class="progress-fill phase-${phase}" style="width: ${lead.progress}%"></div></div>
                </div>

                <div class="status-bar">
                    <div class="status-pill ${lead.intro?'active':''}" onclick="window.toggleTopStatus('${lead.id}', 'intro')">
                        ${lead.intro ? '✔' : '○'} Intro Meeting
                    </div>
                    <div class="status-pill ${lead.weekly?'active':''}" onclick="window.toggleTopStatus('${lead.id}', 'weekly')">
                        ${lead.weekly ? '✔' : '○'} Weekly Calls
                    </div>
                </div>

                <div class="content-body">
                    <div class="col-left">
                        <div class="section-head">Team & Contact</div>
                        <div class="team-grid">
                            ${createTeamCard(iconUser, 'Customer Contact', 'contact', lead.contact, false, [])}
                            ${createTeamCard(iconTarget, 'Strategic Owner', 'strategic', lead.strategic, true, state.dropdowns.strategic)}
                            ${createTeamCard(iconBriefcase, 'Manager Lead', 'manager', lead.manager, true, state.dropdowns.managers)}
                            ${createTeamCard(iconTruck, 'Delivery Lead', 'delivery', lead.delivery, true, state.dropdowns.managers)}
                        </div>

                        <div class="section-head">Pipeline Stages</div>
                        <div class="pipeline-list">
                            <div class="phase-title p1">Phase 1: Exploration</div>
                            ${createPipelineRow('PPTs Shared', 'ppts', lead.pipeline.ppts)}
                            ${createPipelineRow('Verbal Agreement', 'verbal', lead.pipeline.verbal)}
                            <div class="phase-title p2">Phase 2: Validation</div>
                            ${createPipelineRow('NDA Signed', 'nda', lead.pipeline.nda)}
                            ${createPipelineRow('LOI Issued', 'loi_issued', lead.pipeline.loi_issued)}
                            <div class="phase-title p3">Phase 3: Execution</div>
                            ${createPipelineRow('Contract Signed', 'contract', lead.pipeline.contract)}
                            ${createPipelineRow('Parts Received', 'parts', lead.pipeline.parts)}
                        </div>

                        <div class="left-footer">
                            <div style="display:flex; gap:10px; width:100%">
                                ${footerBtns}
                                <button class="btn-outline" style="width:40px; justify-content:center;" onclick="window.deleteLead('${lead.id}')" title="Delete">🗑</button>
                            </div>
                        </div>
                    </div>

                    <div class="col-right">
                        <div class="section-head">Progress Notes / Next Steps</div>
                        <div class="notes-container">
                            <textarea id="notesArea" class="notes-editor" placeholder="Type notes here...">${lead.notes}</textarea>
                            <div class="notes-actions">
                                <button class="btn-primary" onclick="window.saveNotes()">Save Note</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- ACTIONS & API ---
    async function saveLeadData(lead) {
        const btn = dom.saveBtn;
        btn.innerText = 'Saving...';
        recalculateScore(lead);
        applyFiltersAndSort();
        renderDetails(lead);
        
        const payload = { ...lead, ...lead.pipeline, action: 'update' };
        payload['Current Progress'] = lead.notes; delete payload.notes;

        try {
            await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            btn.innerText = '✔ Saved';
            btn.classList.add('btn-success');
            setTimeout(() => { btn.innerText = 'Save Changes'; btn.classList.remove('btn-success'); }, 2000);
        } catch (e) { btn.innerText = 'Error'; }
    }

    // --- GLOBAL FUNCTIONS (EXPOSED TO WINDOW) ---
    function setupGlobalFunctions() {
        window.toggleDead = (id) => { const l = state.allLeads.find(x=>x.id===id); if(l){ l.dead=!l.dead; if(l.dead) l.successful=false; saveLeadData(l); } };
        window.toggleSuccessful = (id) => { const l = state.allLeads.find(x=>x.id===id); if(l){ l.successful=!l.successful; if(l.successful) l.dead=false; saveLeadData(l); } };
        window.togglePipeline = (id, key) => { const l = state.allLeads.find(x=>x.id===id); if(l){ l.pipeline[key]=!l.pipeline[key]; saveLeadData(l); } };
        window.toggleTopStatus = (id, key) => { const l = state.allLeads.find(x=>x.id===id); if(l){ l[key]=!l[key]; saveLeadData(l); } };
        window.saveNotes = () => { const l = state.allLeads.find(x=>x.id===state.selectedLeadId); if(l){ l.notes = document.getElementById('notesArea').value; saveLeadData(l); } };
        
        window.enableEdit = (id, field, val, isDropdown, opts) => {
            const container = document.querySelector(`.team-card #field-${field}`).parentElement; 
            const displaySpan = container.querySelector('.team-name');
            const editBtn = container.querySelector('.edit-btn-mini');
            displaySpan.style.display = 'none'; editBtn.style.display = 'none';

            const wrapper = document.createElement('div');
            if (isDropdown) {
                const options = opts.split('|').map(o=>`<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
                wrapper.innerHTML = `<select class="edit-input" id="input-${field}" onblur="window.finishEdit('${id}','${field}')">${options}<option value="Unassigned">Unassigned</option></select>`;
            } else {
                wrapper.innerHTML = `<input class="edit-input" id="input-${field}" value="${val}" onblur="window.finishEdit('${id}','${field}')" onkeydown="if(event.key==='Enter') window.finishEdit('${id}','${field}')">`;
            }
            container.appendChild(wrapper);
            setTimeout(() => document.getElementById(`input-${field}`).focus(), 50);
        };

        window.finishEdit = (id, field) => {
            const el = document.getElementById(`input-${field}`);
            if(el) {
                const l = state.allLeads.find(x=>x.id===id);
                l[field] = el.value;
                saveLeadData(l);
            }
        };
        
        window.editLogo = (id) => { const l = state.allLeads.find(x=>x.id===id); const u = prompt("Logo URL:", l.logo); if(u!==null){ l.logo=u; saveLeadData(l); }};
        window.editSlides = (id) => { const l = state.allLeads.find(x=>x.id===id); const u = prompt("Slides URL:", l.slides); if(u!==null){ l.slides=u; saveLeadData(l); }};
        window.editLinkedIn = (id) => { const l = state.allLeads.find(x=>x.id===id); const u = prompt("LinkedIn URL:", l.linkedin); if(u!==null){ l.linkedin=u; saveLeadData(l); }};
        
        window.deleteLead = async (id) => {
            const lead = state.allLeads.find(l => l.id === id);
            if(!confirm(`Delete ${lead.customer}?`)) return;
            const btn = document.querySelector('.btn-outline[title="Delete"]');
            if(btn) btn.innerText = '...';
            try {
                await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', customer: lead.customer }) });
                alert('Deleted'); fetchData();
            } catch(e) { alert('Network Error'); }
        };
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() { 
        dom.refreshBtn.addEventListener('click', fetchData);
        dom.sortBtns.prob.addEventListener('click', () => setSort('score', 'desc'));
        dom.sortBtns.name.addEventListener('click', () => setSort('customer', 'asc'));
        dom.phaseSelect.addEventListener('change', applyFiltersAndSort);
        dom.originSelect.addEventListener('change', applyFiltersAndSort);
        dom.typeSelect.addEventListener('change', applyFiltersAndSort);
        dom.managerSelect.addEventListener('change', applyFiltersAndSort);
        dom.stageSelect.addEventListener('change', applyFiltersAndSort);
        dom.searchInput.addEventListener('input', applyFiltersAndSort);
        dom.addLeadBtn.onclick = async () => {
            const name = prompt("Name:"); if(!name) return;
            dom.addLeadBtn.innerText = '...';
            await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'create', customer: name }) });
            alert('Created'); dom.addLeadBtn.innerText = '+ Add Lead'; fetchData();
        };
    }

    function setSort(field, dir) { state.sort.field=field; state.sort.direction=dir; applyFiltersAndSort(); }
    
    function populateFilters() {
        const mgrs = state.dropdowns.managers;
        dom.managerSelect.innerHTML = '<option value="all">All Managers</option>' + mgrs.map(m=>`<option value="${m}">${m}</option>`).join('');
        const origins = [...new Set(state.allLeads.map(l=>l.origin))].filter(Boolean).sort();
        dom.originSelect.innerHTML = '<option value="all">All Origins</option>' + origins.map(o=>`<option value="${o}">${o}</option>`).join('');
    }
});
