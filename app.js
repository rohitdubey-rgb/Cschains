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
        users: [],
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
        sortBtns: { prob: document.getElementById('sortProb'), name: document.getElementById('sortName') },
        pipelineView: document.getElementById('pipelineView'),
        dashboardView: document.getElementById('dashboardView'),
        showPipelineBtn: document.getElementById('showPipelineBtn'),
        showDashboardBtn: document.getElementById('showDashboardBtn')
    };

    // INITIALIZE
    init();

    function init() {
        Dashboard.init('dashboardContent');
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

            // Support both legacy array format and new { leads, users } format
            const leadsData = Array.isArray(data) ? data : (data.leads || []);
            state.users = Array.isArray(data) ? [] : (data.users || []);
            state.allLeads = leadsData.map((item, index) => normalizeLead(item, index));
            extractDropdownOptions();
            populateFilters();
            applyFiltersAndSort();
            Dashboard.render(state.allLeads);

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
        const userNames = state.users.map(u => u.name).sort();
        state.dropdowns.managers = userNames;
        state.dropdowns.strategic = userNames;
        state.dropdowns.delivery = userNames;
    }

    // --- LOGIC ---
    function recalculateScore(lead) {
        let score = 0;
        if (lead.dead || lead.hibernated) { lead.score = 0; lead.progress = 0; lead.phase = 0; return; }
        if (lead.successful) { lead.score = 160; lead.progress = 100; lead.phase = 3; return; }

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
            phone: getValue('Phone') || '',
            needsAction: checkBool('Needs Action'),
            hibernated: checkBool('Hibernated'),
            deadAnalysis: getValue('Dead Analysis') || '',
            description: getValue('Description') || getValue('Company Description') || '',
            tags: []
        };
        if (lead.origin) lead.tags.push({ text: lead.origin, type: 'blue' });
        const typeStr = String(getValue('PIM or CM')).toLowerCase();
        if (typeStr.includes('both')) { lead.tags.push({ text: 'BOTH', type: 'both' }); lead.type = 'both'; }
        else if (typeStr.includes('pim')) { lead.tags.push({ text: 'PIM', type: 'pim' }); lead.type = 'pim'; }
        else if (typeStr.includes('cm')) { lead.tags.push({ text: 'CM', type: 'cm' }); lead.type = 'cm'; }

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
        // Use epoch (Jan 1 1970) as placeholder for legacy notes with no date
        return notes.map(n => `${(n.date || new Date(0)).toISOString()}|||${n.content}`).join('\n===\n');
    }

    function formatNoteDate(date) {
        if (!date || date.getTime() === 0) return 'Legacy Note';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function formatNoteContent(raw) {
        return raw
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/^---$/gm, '<hr class="note-hr">')
            .replace(/!\[image\]\((.*?)\)/g, '<div class="chat-image-container"><img src="$1" class="chat-image" onclick="window.open(\'$1\', \'_blank\')"></div>')
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

            // Dead, successful and hibernated leads bypass phase/stage filters
            if (lead.dead || lead.successful || lead.hibernated) return baseFilters;

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
        
        // 1. Filter leads into categories
        // Priority leads are those marked as "Needs Action" BUT NOT dead or successful
        const priorityLeads = state.filteredLeads.filter(l => l.needsAction && !l.dead && !l.successful);
        
        // Active leads are NOT dead, NOT successful, NOT hibernated, and NOT priority
        const activeLeads = state.filteredLeads.filter(l => !l.dead && !l.successful && !l.hibernated && !l.needsAction);
        
        const successfulLeads = state.filteredLeads.filter(l => l.successful);
        const deadLeads = state.filteredLeads.filter(l => l.dead);
        const hibernatedLeads = state.filteredLeads.filter(l => l.hibernated);
        
        const total = priorityLeads.length + activeLeads.length + successfulLeads.length + deadLeads.length + hibernatedLeads.length;
        dom.listCount.innerText = total;
        
        if (total === 0) { 
            dom.listContainer.innerHTML = '<div class="empty-state">No leads match.</div>'; 
            return; 
        }

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
                } else if (lead.hibernated) {
                    statusClass = 'is-hibernated';
                    iconContent = '💤';
                    probBadge = `<span class="win-prob" style="background:#7c3aed; color:white">ON HOLD</span>`;
                } else {
                    statusClass = `phase-${lead.phase}`;
                    iconContent = lead.phase === 3 ? '★' : '📄';
                    probBadge = `<span class="win-prob">${lead.progress}%</span>`;
                }

                row.id = `row-${lead.id}`;
                row.className = `lead-row ${statusClass} ${state.selectedLeadId === lead.id ? 'active' : ''} ${lead.needsAction ? 'needs-action-glow' : ''}`;
                row.style.animationDelay = `${globalIdx * 0.05}s`;
                row.onclick = () => selectLead(lead.id);
                globalIdx++;

                const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
                const latestNote = (() => { const p = parseNotes(lead.notes); return p.length ? p[0].content : ''; })();
                row.innerHTML = `
                    <div class="lead-icon-col"><div class="icon-circle">${iconContent}</div></div>
                    <div class="lead-content-col">
                        <div class="lead-name">${lead.customer} ${tagsHtml}</div>
                        <div class="lead-notes">${latestNote || 'No progress notes'}</div>
                    </div>
                    <div class="lead-meta-col">${probBadge}</div>
                `;
                dom.listContainer.appendChild(row);
            });
        };

        renderSection(priorityLeads, 'Priorities / Needs Action');
        renderSection(activeLeads, 'Active');
        renderSection(hibernatedLeads, 'Hibernation');
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
                        ${fieldKey === 'contact' ? linkedinBtn : ''}
                    </div>
                    <div style="display:flex; align-items:center;">
                        <span class="team-name ${val ? '' : 'unassigned'}">${val || 'Unassigned'}</span>
                        <span class="edit-btn-mini" onclick="window.enableEdit('${lead.id}', '${fieldKey}', '${val || ''}', ${isDrop}, '${opts ? opts.join('|') : ''}', this)">✎</span>
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
        } else if (lead.hibernated) {
            footerBtns = `<button class="btn-block-revive" style="flex:1" onclick="window.toggleHibernated('${lead.id}')">🌞 Restore from Hibernation</button>`;
        } else {
            footerBtns = `
                <button class="btn-block-success" style="flex:1" onclick="window.toggleSuccessful('${lead.id}')">✓ Mark as Successful</button>
                <button class="btn-danger btn-block-danger" style="flex:1" onclick="window.toggleDead('${lead.id}')">✕ Mark as Dead</button>
                <button class="btn-outline" style="flex:1; color:#7c3aed; border-color:#ddd6fe; background:#f5f3ff;" onclick="window.toggleHibernated('${lead.id}')">💤 Hibernate</button>
            `;
        }

        // NEEDS ACTION TOGGLE (STAR)
        const actionHtml = `<button class="btn-action-star ${lead.needsAction ? 'active' : ''}" 
            onclick="window.toggleNeedsAction('${lead.id}')" title="${lead.needsAction ? 'Priority' : 'Mark Priority'}">
            ${lead.needsAction ? '⭐' : '☆'}
        </button>`;

        // DEAD ANALYSIS SECTION
        const deadAnalysisHtml = lead.dead 
            ? `<div class="dead-analysis-section" style="margin-top:20px; padding:15px; background:#fef2f2; border:1px solid #fee2e2; border-radius:12px;">
                <div class="section-head" style="color:#b91c1c; border-bottom-color:#fee2e2;">Loss Analysis / Why Dead?</div>
                <textarea id="deadAnalysisArea" class="note-edit-textarea" style="min-height:80px; font-size:0.85rem;" 
                    placeholder="Why was this lead lost?" 
                    onblur="window.saveDeadAnalysis('${lead.id}', this.value)">${lead.deadAnalysis || ''}</textarea>
               </div>`
            : '';

        // RENDER DETAILS HTML
        dom.detailsPanel.innerHTML = `
            <div class="detail-card phase-${phase} ${lead.dead ? 'is-dead' : ''} ${lead.hibernated ? 'is-hibernated' : ''}">
                <div class="detail-header-top">
                    <div style="display:flex; align-items:center; gap:20px; flex:1;">
                        <div onclick="window.editLogo('${lead.id}')">${logoHtml}</div>
                        <div class="customer-title">
                            <div style="display:flex; align-items:center; gap:10px; flex-wrap: wrap;">
                                <h2>${lead.customer}</h2>
                                ${actionHtml}
                                <div class="company-description-container" onclick="window.enableEdit('${lead.id}', 'description', '${lead.description || ''}', false, '', this.querySelector('.edit-btn-mini'))">
                                    <span class="company-description ${lead.description ? '' : 'unassigned'}">${lead.description || 'Add description...'}</span>
                                    <span class="edit-btn-mini">✎</span>
                                </div>
                            </div>
                            <div class="detail-tags">${lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('')}</div>
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
                    <div class="status-pill ${lead.intro ? 'active' : ''}" onclick="window.toggleTopStatus('${lead.id}', 'intro')">
                        ${lead.intro ? '✔' : '○'} Intro Meeting
                    </div>
                    <div class="status-pill ${lead.weekly ? 'active' : ''}" onclick="window.toggleTopStatus('${lead.id}', 'weekly')">
                        ${lead.weekly ? '✔' : '○'} Weekly Calls
                    </div>
                </div>

                <div class="content-body">
                    <div class="col-left">
                        <div class="section-head">Team & Contact</div>
                        <div class="team-grid">
                            <div class="team-card">
                                <div class="team-icon-box">${iconUser}</div>
                                <div class="team-info">
                                    <div style="display:flex; justify-content:space-between">
                                        <span class="team-role">Customer Contact</span>
                                        <div style="display:flex; align-items:center;">
                                            ${linkedinBtn}
                                        </div>
                                    </div>
                                    <div style="display:flex; align-items:center;">
                                        <span class="team-name ${lead.contact ? '' : 'unassigned'}">${lead.contact || 'Unassigned'}</span>
                                        <span class="edit-btn-mini" onclick="window.enableEdit('${lead.id}', 'contact', '${lead.contact || ''}', false, '', this)">✎</span>
                                    </div>
                                </div>
                            </div>
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

                        ${deadAnalysisHtml}

                        <div class="left-footer" style="padding-top:20px;">
                            <div style="display:flex; gap:10px; width:100%">
                                ${footerBtns}
                                <button class="btn-outline" style="width:40px; justify-content:center;" onclick="window.deleteLead('${lead.id}')" title="Delete">🗑</button>
                            </div>
                        </div>
                    </div>

                    <div class="col-right">
                        <div class="notes-section-head">
                            <span>Progress Notes / Next Steps</span>
                        </div>
                        <div class="notes-container">
                            <div class="notes-log" id="notesLog">
                                ${(() => {
                const parsed = parseNotes(lead.notes);
                if (parsed.length === 0) return '<div class="notes-empty">No notes yet — type one below and press Enter.</div>';
                return parsed.map((note, origIdx) => ({ note, origIdx })).reverse().map(({ note, origIdx }, i) => {
                    const c = NOTE_COLORS[i % NOTE_COLORS.length];
                    const userOpts = state.users.map(u => `<option value="${u.email}">${u.name}</option>`).join('');
                    return `<div class="chat-msg" id="chat-note-${origIdx}" data-raw="${encodeURIComponent(note.content)}">
                                             <div class="chat-bubble" style="background:${c.bg}; border-color:${c.border}">
                                                 <div class="chat-text">${formatNoteContent(note.content)}</div>
                                                 <div class="bubble-actions">
                                                     <button class="bubble-btn edit-btn" onclick="window.editNote('${lead.id}', ${origIdx})" title="Edit">
                                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                                                     </button>
                                                     <button class="bubble-btn delete-btn" onclick="window.deleteNote('${lead.id}', ${origIdx})" title="Delete">
                                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                                                     </button>
                                                     <button class="bubble-btn mail-btn" onclick="window.showNoteMailPanel('${lead.id}', ${origIdx})" title="Email/Schedule this note">
                                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                                                     </button>
                                                     ${lead.phone ? `
                                                     <a href="https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(note.content)}" 
                                                        target="_blank" class="bubble-btn whatsapp-btn" title="Send update via WhatsApp" 
                                                        style="background:#25d366; color:white; display:flex; align-items:center; justify-content:center;">
                                                         <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.005c6.551 0 11.889-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                     </a>` : ''}
                                                 </div>
                                             </div>
                                             <div class="note-mail-panel" id="mail-panel-${origIdx}" style="display:none; flex-direction:column; gap:8px;">
                                                 <div style="display:flex; gap:8px; width:100%">
                                                    <select class="mail-panel-select" id="mail-panel-sel-${origIdx}" style="flex:1">
                                                        <option value="">Select recipient…</option>
                                                        ${userOpts}
                                                    </select>
                                                    <button class="mail-panel-close" onclick="document.getElementById('mail-panel-${origIdx}').style.display='none'">✕</button>
                                                 </div>
                                                 <div style="display:flex; gap:8px; align-items:center;">
                                                    <input type="datetime-local" class="mail-panel-select" id="mail-panel-date-${origIdx}" style="flex:1">
                                                    <button class="mail-panel-send" id="mail-panel-btn-${origIdx}" onclick="window.handleNoteMail('${lead.id}', ${origIdx})">Send / Schedule</button>
                                                 </div>
                                             </div>
                                             <div class="chat-time" style="color:${c.accent}">${formatNoteDate(note.date)}</div>
                                         </div>`;
                }).join('');
            })()}
                            </div>
                            <div class="notes-input-bar">
                                <textarea id="notesArea" class="notes-chat-input" placeholder="Type a note... (Paste images or press Enter to send)"
                                    onkeydown="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); window.saveNotes(); }"
                                    onpaste="window.handlePaste(event)"></textarea>
                                <div class="fmt-btns">
                                    <button class="fmt-btn" onclick="document.getElementById('imageUploadInput').click()" title="Upload Image">📷</button>
                                    <button class="fmt-btn" onclick="window.noteFormat('bold')" title="Bold"><b>B</b></button>
                                    <button class="fmt-btn" onclick="window.noteFormat('italic')" title="Italic"><i>I</i></button>
                                    <button class="fmt-btn" onclick="window.noteFormat('bullet')" title="Bullet">•</button>
                                    <button class="fmt-btn" onclick="window.noteFormat('divider')" title="Divider">—</button>
                                </div>
                                <button class="notes-send-btn" onclick="window.saveNotes()">↑</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        // Scroll notes log to bottom (newest message visible)
        const notesLog = document.getElementById('notesLog');
        if (notesLog) notesLog.scrollTop = notesLog.scrollHeight;
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
        window.toggleDead = (id) => { const l = state.allLeads.find(x => x.id === id); if (l) { l.dead = !l.dead; if (l.dead) { l.successful = false; l.hibernated = false; } saveLeadData(l); } };
        window.toggleSuccessful = (id) => { const l = state.allLeads.find(x => x.id === id); if (l) { l.successful = !l.successful; if (l.successful) { l.dead = false; l.hibernated = false; } saveLeadData(l); } };
        window.toggleHibernated = (id) => { const l = state.allLeads.find(x => x.id === id); if (l) { l.hibernated = !l.hibernated; if (l.hibernated) { l.dead = false; l.successful = false; } saveLeadData(l); } };
        window.togglePipeline = (id, key) => { const l = state.allLeads.find(x => x.id === id); if (l) { l.pipeline[key] = !l.pipeline[key]; saveLeadData(l); } };
        window.toggleTopStatus = (id, key) => { const l = state.allLeads.find(x => x.id === id); if (l) { l[key] = !l[key]; saveLeadData(l); } };
        window.saveNotes = () => {
            const input = document.getElementById('notesArea');
            if (!input || !input.value.trim()) return;
            const text = input.value.trim();
            input.value = '';
            const l = state.allLeads.find(x => x.id === state.selectedLeadId);
            if (l) {
                const existing = parseNotes(l.notes);
                const newEntry = { date: new Date(), content: text };
                l.notes = serializeNotes([newEntry, ...existing]);
                saveLeadData(l);
            }
        };

        window.toggleMailDropdown = () => {
            const p = document.getElementById('mailPopover');
            if (p) p.classList.toggle('open');
        };

        window.sendNotesEmail = async (leadId) => {
            const sel = document.getElementById('mailUserSelect');
            const btn = document.getElementById('mailSendBtn');
            if (!sel || !sel.value) { sel.focus(); return; }
            const l = state.allLeads.find(x => x.id === leadId);
            if (!l) return;
            btn.textContent = 'Sending…';
            btn.disabled = true;
            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'sendEmail',
                        customer: l.customer,
                        notes: l.notes,
                        recipientEmail: sel.value,
                        recipientName: sel.options[sel.selectedIndex].text
                    })
                });
                const result = await res.json();
                if (result.success) {
                    btn.textContent = '✓ Sent';
                    setTimeout(() => {
                        const p = document.getElementById('mailPopover');
                        if (p) p.classList.remove('open');
                        btn.textContent = 'Send';
                        btn.disabled = false;
                        sel.value = '';
                    }, 1800);
                } else {
                    btn.textContent = 'Error';
                    btn.disabled = false;
                }
            } catch (e) {
                btn.textContent = 'Error';
                btn.disabled = false;
            }
        };

        window.deleteNote = (leadId, noteIdx) => {
            const l = state.allLeads.find(x => x.id === leadId);
            if (!l) return;
            const parsed = parseNotes(l.notes);
            parsed.splice(noteIdx, 1);
            l.notes = parsed.length > 0 ? serializeNotes(parsed) : '';
            saveLeadData(l);
        };

        window.showNoteMailPanel = (leadId, noteIdx) => {
            // Close any other open panels first
            document.querySelectorAll('.note-mail-panel').forEach(p => p.style.display = 'none');
            const panel = document.getElementById(`mail-panel-${noteIdx}`);
            if (panel) { panel.style.display = 'flex'; document.getElementById(`mail-panel-sel-${noteIdx}`)?.focus(); }
        };

        window.sendSingleNote = async (leadId, noteIdx) => {
            const sel = document.getElementById(`mail-panel-sel-${noteIdx}`);
            const btn = document.getElementById(`mail-panel-btn-${noteIdx}`);
            const dateInput = document.getElementById(`mail-panel-date-${noteIdx}`);

            if (!sel || !sel.value) { sel?.focus(); return; }
            const l = state.allLeads.find(x => x.id === leadId);
            if (!l) return;
            const parsed = parseNotes(l.notes);
            const note = parsed[noteIdx];
            if (!note) return;

            const isScheduled = dateInput && dateInput.value;
            btn.textContent = isScheduled ? 'Scheduling…' : 'Sending…'; btn.disabled = true;
            
            try {
                const payload = {
                    action: isScheduled ? 'scheduleemail' : 'sendemail',
                    customer: l.customer,
                    notes: serializeNotes([note]),
                    recipientEmail: sel.value,
                    recipientName: sel.options[sel.selectedIndex].text
                };
                if (isScheduled) payload.scheduledDate = dateInput.value;

                const res = await fetch(API_URL, {
                    method: 'POST', body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.success) {
                    btn.textContent = isScheduled ? '✓ Scheduled' : '✓ Sent';
                    setTimeout(() => { 
                        document.getElementById(`mail-panel-${noteIdx}`).style.display = 'none'; 
                        btn.textContent = 'Send / Schedule'; btn.disabled = false; 
                    }, 1800);
                } else { btn.textContent = 'Error'; btn.disabled = false; }
            } catch (e) { btn.textContent = 'Error'; btn.disabled = false; }
        };

        window.handleNoteMail = (leadId, noteIdx) => {
            window.sendSingleNote(leadId, noteIdx);
        };

        window.toggleNeedsAction = (id) => {
            const l = state.allLeads.find(x => x.id === id);
            if (l) {
                l.needsAction = !l.needsAction;
                saveLeadData(l);
            }
        };

        window.saveDeadAnalysis = (id, val) => {
            const l = state.allLeads.find(x => x.id === id);
            if (l && l.deadAnalysis !== val) {
                l.deadAnalysis = val;
                saveLeadData(l);
            }
        };

        window.editPhone = (id) => {
            const l = state.allLeads.find(x => x.id === id);
            const p = prompt("Enter Phone (for WhatsApp):", l.phone);
            if (p !== null) {
                l.phone = p;
                saveLeadData(l);
            }
        };

        window.handlePaste = async (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    window.uploadAndSaveImage(blob);
                }
            }
        };

        window.uploadAndSaveImage = async (file) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result.split(',')[1];
                const ta = document.getElementById('notesArea');
                ta.disabled = true; ta.placeholder = "Uploading image...";
                
                try {
                    const res = await fetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'uploadimage',
                            data: base64,
                            contentType: file.type,
                            fileName: file.name
                        })
                    });
                    const result = await res.json();
                    if (result.success) {
                        const imgUrl = result.url;
                        const l = state.allLeads.find(x => x.id === state.selectedLeadId);
                        if (l) {
                            const existing = parseNotes(l.notes);
                            const newEntry = { date: new Date(), content: `![image](${imgUrl})` };
                            l.notes = serializeNotes([newEntry, ...existing]);
                            saveLeadData(l);
                        }
                    } else { alert("Upload failed"); }
                } catch (err) { alert("Error uploading"); }
                finally { ta.disabled = false; ta.placeholder = "Type a note..."; ta.focus(); }
            };
            reader.readAsDataURL(file);
        };

        // SETUP FILE INPUT
        const fileInput = document.getElementById('imageUploadInput');
        if (fileInput) {
            fileInput.onchange = (e) => {
                if (e.target.files && e.target.files[0]) {
                    window.uploadAndSaveImage(e.target.files[0]);
                }
            };
        }

        window.editNote = (leadId, noteIdx) => {
            const msgEl = document.getElementById(`chat-note-${noteIdx}`);
            if (!msgEl) return;
            const bubble = msgEl.querySelector('.chat-bubble');
            bubble.classList.add('is-editing');
            const rawContent = decodeURIComponent(msgEl.dataset.raw);
            bubble.innerHTML = `
                <textarea class="note-edit-textarea" id="note-edit-inp-${noteIdx}"></textarea>
                <div class="note-edit-actions">
                    <button class="note-edit-save" onclick="window.saveNoteEdit('${leadId}', ${noteIdx})">Save</button>
                    <button class="note-edit-cancel" onclick="window.cancelNoteEdit('${leadId}', ${noteIdx})">Cancel</button>
                </div>`;
            const ta = document.getElementById(`note-edit-inp-${noteIdx}`);
            ta.value = rawContent;
            ta.focus();
            ta.setSelectionRange(ta.value.length, ta.value.length);
        };

        window.saveNoteEdit = (leadId, noteIdx) => {
            const ta = document.getElementById(`note-edit-inp-${noteIdx}`);
            if (!ta) return;
            const l = state.allLeads.find(x => x.id === leadId);
            if (!l) return;
            const parsed = parseNotes(l.notes);
            if (!parsed[noteIdx]) return;
            parsed[noteIdx].content = ta.value.trim();
            l.notes = serializeNotes(parsed);
            saveLeadData(l);
        };

        window.cancelNoteEdit = (leadId, noteIdx) => {
            const l = state.allLeads.find(x => x.id === leadId);
            if (l) renderDetails(l);
        };

        window.noteFormat = (type) => {
            const ta = document.getElementById('notesArea');
            if (!ta) return;
            const start = ta.selectionStart, end = ta.selectionEnd;
            const selected = ta.value.substring(start, end);
            let rep = '';
            if (type === 'bold') rep = `**${selected || 'bold text'}**`;
            if (type === 'italic') rep = `_${selected || 'italic text'}_`;
            if (type === 'bullet') rep = (start > 0 ? '\n' : '') + `• ${selected || 'item'}`;
            if (type === 'divider') rep = (start > 0 ? '\n' : '') + '---\n';
            ta.value = ta.value.substring(0, start) + rep + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + rep.length;
            ta.focus();
        };

        window.enableEdit = (id, field, val, isDropdown, opts, btnEl) => {
            const container = btnEl ? (btnEl.closest('.team-info') || btnEl.parentElement) : document.querySelector(`.team-card #field-${field}`)?.parentElement;
            if (!container) return;
            const displaySpan = container.querySelector('.team-name') || container.querySelector('.company-description');
            const editBtn = container.querySelector('.edit-btn-mini');
            if (displaySpan) displaySpan.style.display = 'none';
            if (editBtn) editBtn.style.display = 'none';

            const wrapper = document.createElement('div');
            if (isDropdown) {
                const options = opts.split('|').map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');
                wrapper.innerHTML = `<select class="edit-input" id="input-${field}" onblur="window.finishEdit('${id}','${field}')">${options}<option value="Unassigned">Unassigned</option></select>`;
            } else {
                wrapper.innerHTML = `<input class="edit-input" id="input-${field}" value="${val}" onblur="window.finishEdit('${id}','${field}')" onkeydown="if(event.key==='Enter') window.finishEdit('${id}','${field}')">`;
            }
            container.appendChild(wrapper);
            setTimeout(() => document.getElementById(`input-${field}`).focus(), 50);
        };

        window.finishEdit = (id, field) => {
            const el = document.getElementById(`input-${field}`);
            if (el) {
                const l = state.allLeads.find(x => x.id === id);
                l[field] = el.value;
                saveLeadData(l);
            }
        };

        window.editLogo = (id) => { const l = state.allLeads.find(x => x.id === id); const u = prompt("Logo URL:", l.logo); if (u !== null) { l.logo = u; saveLeadData(l); } };
        window.editSlides = (id) => { const l = state.allLeads.find(x => x.id === id); const u = prompt("Slides URL:", l.slides); if (u !== null) { l.slides = u; saveLeadData(l); } };
        window.editLinkedIn = (id) => { const l = state.allLeads.find(x => x.id === id); const u = prompt("LinkedIn URL:", l.linkedin); if (u !== null) { l.linkedin = u; saveLeadData(l); } };

        window.deleteLead = async (id) => {
            const lead = state.allLeads.find(l => l.id === id);
            if (!confirm(`Delete ${lead.customer}?`)) return;
            const btn = document.querySelector('.btn-outline[title="Delete"]');
            if (btn) btn.innerText = '...';
            try {
                await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', customer: lead.customer }) });
                alert('Deleted'); fetchData();
            } catch (e) { alert('Network Error'); }
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

        dom.showPipelineBtn.onclick = () => switchView('pipeline');
        dom.showDashboardBtn.onclick = () => switchView('dashboard');

        dom.addLeadBtn.onclick = async () => {
            const name = prompt("Name:"); if (!name) return;
            dom.addLeadBtn.innerText = '...';
            await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'create', customer: name }) });
            alert('Created'); dom.addLeadBtn.innerText = '+ Add Lead'; fetchData();
        };
    }

    function setSort(field, dir) { state.sort.field = field; state.sort.direction = dir; applyFiltersAndSort(); }

    function switchView(view) {
        if (view === 'pipeline') {
            dom.pipelineView.style.display = 'flex';
            dom.dashboardView.style.display = 'none';
            dom.showPipelineBtn.classList.add('active');
            dom.showDashboardBtn.classList.remove('active');
            document.querySelector('.filter-section').style.display = 'flex';
        } else {
            dom.pipelineView.style.display = 'none';
            dom.dashboardView.style.display = 'flex';
            dom.showPipelineBtn.classList.remove('active');
            dom.showDashboardBtn.classList.add('active');
            document.querySelector('.filter-section').style.display = 'none';
            Dashboard.render(state.allLeads);
        }
    }

    function populateFilters() {
        const mgrs = state.dropdowns.managers;
        dom.managerSelect.innerHTML = '<option value="all">All Managers</option>' + mgrs.map(m => `<option value="${m}">${m}</option>`).join('');
        const origins = [...new Set(state.allLeads.map(l => l.origin))].filter(Boolean).sort();
        dom.originSelect.innerHTML = '<option value="all">All Origins</option>' + origins.map(o => `<option value="${o}">${o}</option>`).join('');
    }
});
