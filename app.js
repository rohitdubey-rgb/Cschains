document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------
    // PASTE YOUR WEB APP URL HERE
    // -----------------------------------------------------------
    const API_URL = 'https://script.google.com/macros/s/AKfycbxu4jqVeoiLemxJP_dKe_Xhw8jsmaqe7SwIBCSLf7LK9ZecJj83L7B-Cgv-MCdPaPKrSA/exec';
    
    const state = {
        allLeads: [],
        filteredLeads: [],
        selectedLeadId: null,
        dropdowns: { managers: [], strategic: [], delivery: [] },
        sort: { field: 'score', direction: 'desc' }
    };

    // DOM Elements (Keep existing)
    const dom = {
        listContainer: document.getElementById('leadsListContainer'),
        detailsPanel: document.getElementById('detailsPanel'),
        searchInput: document.getElementById('searchInput'),
        listCount: document.getElementById('listCount'),
        totalCount: document.getElementById('totalCount'),
        refreshBtn: document.getElementById('refreshBtn'),
        saveBtn: document.getElementById('globalSaveBtn'),
        lastUpdated: document.getElementById('lastUpdated'),
        originSelect: document.getElementById('originSelect'),
        typeSelect: document.getElementById('typeSelect'),
        managerSelect: document.getElementById('managerSelect'),
        stageSelect: document.getElementById('stageSelect'),
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
        setupGlobalFunctions();
    }

    async function fetchData() {
        try {
            dom.listContainer.innerHTML = '<div class="loading-state">Fetching leads...</div>';
            const response = await fetch(API_URL);
            const data = await response.json();
            console.log("🔥 Loaded:", data);

            state.allLeads = data.map((item, index) => normalizeLead(item, index));
            extractDropdownOptions();
            populateFilters();
            applyFiltersAndSort();
            updateTimestamp();
            
            if (state.filteredLeads.length > 0) selectLead(state.filteredLeads[0].id);
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

    async function saveLeadData(lead) {
        const btn = dom.saveBtn;
        const originalText = btn.innerHTML;
        btn.innerHTML = `Saving...`;
        btn.style.opacity = "0.7";

        // Optimistic UI Update
        renderList();
        renderDetails(lead);
        
        // Payload includes NEW fields
        const payload = {
            customer: lead.customer,
            notes: lead.notes,
            logo: lead.logo,
            linkedin: lead.linkedin, // NEW
            slides: lead.slides,     // NEW
            contact: lead.contact,
            manager: lead.manager,
            strategic: lead.strategic,
            delivery: lead.delivery,
            
            // Pipeline Stages (Booleans)
            ppts: lead.pipeline.ppts,
            verbal: lead.pipeline.verbal,
            nda: lead.pipeline.nda,
            loi_issued: lead.pipeline.loi_issued,
            loi_signed: lead.pipeline.loi_signed,
            contract: lead.pipeline.contract,
            parts: lead.pipeline.parts
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' }, 
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.status === 'success') {
                btn.innerHTML = `✔ Saved!`;
                btn.classList.add('btn-success');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('btn-success');
                    btn.style.opacity = "1";
                }, 2000);
            } else {
                throw new Error(result.message);
            }
        } catch (e) {
            console.error("Save Error:", e);
            btn.innerHTML = `✖ Error`;
            btn.classList.add('btn-error');
            alert("Save Failed: " + e.message);
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('btn-error');
                btn.style.opacity = "1";
            }, 3000);
        }
    }

    function normalizeLead(item, index) {
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

        const company = getValue('Customer') || getValue('Company') || 'Unknown Company';
        
        // Extra Fields
        const logoUrl = getValue('Logo URL') || getValue('Logo') || ''; 
        const linkedinUrl = getValue('LinkedIn') || getValue('Social') || '';
        const slidesUrl = getValue('Slides URL') || getValue('Slides') || '';

        const contact = getValue('Customer Point of Contact') || 'Unknown';
        const manager = getValue('Management Lead') || getValue('Manager') || 'Unassigned';
        const strategic = getValue('Strategic Owner') || 'Unassigned';
        const delivery = getValue('Delivery Lead') || 'Unassigned';
        const origin = getValue('Lead Origin') || '';
        const pimOrCmValue = getValue('PIM or CM');
        
        let notes = getValue('Notes') || getValue('Next Steps') || "No notes";
        if (String(notes).match(/^\d{4}-\d{2}-\d{2}/)) notes = "No progress notes";

        const tags = [];
        if (origin) tags.push({ text: origin, type: 'blue' });
        
        const typeStr = String(pimOrCmValue).toLowerCase().trim();
        let normalizedType = 'none';
        if (typeStr.includes('both')) { tags.push({ text: 'BOTH', type: 'both' }); normalizedType = 'both'; }
        else if (typeStr.includes('pim')) { tags.push({ text: 'PIM', type: 'pim' }); normalizedType = 'pim'; }
        else if (typeStr.includes('cm')) { tags.push({ text: 'CM', type: 'cm' }); normalizedType = 'cm'; }

        // Pipeline booleans
        const intro = checkBool('Introductory Meeting') || checkBool('Intro');
        const weekly = checkBool('Weekly Calls');
        
        const pipeline = {
            ppts: checkBool('PPTs Shared'),
            verbal: checkBool('Verbal Agreement'),
            nda: checkBool('NDA Signed'),
            loi_issued: checkBool('LOI Issued'),
            loi_signed: checkBool('LOI Signed'),
            contract: checkBool('Contract Signed'),
            parts: checkBool('Parts & Spend Received')
        };

        if (pipeline.loi_issued) tags.push({ text: 'LOI Issued', type: 'loi' });
        if (typeStr.includes('past')) tags.push({ text: 'From Past', type: 'past' });

        // Score
        let score = 0;
        if (intro) score += 10;
        if (weekly) score += 5;
        if (pipeline.ppts) score += 10;
        if (pipeline.verbal) score += 15;
        if (pipeline.nda) score += 10;
        if (pipeline.loi_issued) score += 20;
        if (pipeline.loi_signed) score += 30;
        if (pipeline.contract) score += 50;
        if (pipeline.parts) score += 10;
        let progress = Math.min(100, Math.round((score / 160) * 100));

        return {
            id: `lead-${index}`,
            customer: company, 
            logo: logoUrl, linkedin: linkedinUrl, slides: slidesUrl, // NEW Fields
            contact, manager, strategic, delivery, notes, tags, origin, type: normalizedType,
            score, progress,
            date: new Date(),
            displayDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            intro, weekly,
            pipeline: pipeline
        };
    }

    // --- RENDER LOGIC ---
    function renderDetails(lead) {
        if (!lead) return;

        const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
        const checkIcon = `<svg width="16" height="16" stroke="var(--success)" fill="none" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
        const xIcon = `<svg width="16" height="16" stroke="var(--text-light)" fill="none" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        const pencilIcon = `<svg class="edit-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

        // Helper: Create Text or Dropdown Input
        const createEditable = (fieldKey, value, isDropdown = false, optionsList = []) => {
            const displayVal = value || 'Unassigned';
            return `
            <div class="editable-field" id="field-${fieldKey}">
                <span class="info-value ${value ? '' : 'unassigned'}">${displayVal}</span>
                <span onclick="window.enableEdit('${lead.id}', '${fieldKey}', '${value || ''}', ${isDropdown}, '${optionsList.join('|')}')">${pencilIcon}</span>
            </div>`;
        };

        // NEW: Clickable Pipeline Row
        const createPipeRow = (label, key, val) => `
            <div class="pipeline-item clickable" onclick="window.togglePipeline('${lead.id}', '${key}')">
                <span>${label}</span>
                <span class="${val ? 'status-text-yes' : 'status-text-no'}">${val ? 'Yes' : 'No'}</span>
            </div>
        `;

        // NEW: LinkedIn Button Logic
        const linkedinBtn = lead.linkedin 
            ? `<a href="${lead.linkedin}" target="_blank" class="icon-btn-link" title="Open LinkedIn"><svg width="16" height="16" fill="#0077b5" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></a>`
            : `<span class="icon-btn-empty" title="No LinkedIn">LI</span>`;

        // NEW: Slides Button Logic
        const slidesBtn = lead.slides 
            ? `<a href="${lead.slides}" target="_blank" class="btn btn-slides"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Open Slides</a>`
            : `<button class="btn btn-outline" onclick="window.editSlides('${lead.id}')">+ Add Slides</button>`;

        const logoHtml = lead.logo 
            ? `<img src="${lead.logo}" class="company-logo" alt="Logo">`
            : `<div class="logo-placeholder">${lead.customer.charAt(0)}</div>`;

        dom.detailsPanel.innerHTML = `
            <div class="detail-card">
                <div class="detail-header-top">
                    <div>
                        <div style="cursor:pointer" onclick="window.editLogo('${lead.id}')" title="Click to change logo">${logoHtml}</div>
                    </div>
                    <div style="flex:1; margin-left:15px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <h2>${lead.customer}</h2>
                            <div>${slidesBtn}</div>
                        </div>
                        <div class="detail-tags">${tagsHtml}</div>
                    </div>
                </div>

                <div style="font-size:0.75rem; color:var(--text-gray); display:flex; justify-content:space-between;">
                    <span>Pipeline Progress</span>
                    <strong>${lead.progress}%</strong>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${lead.progress}%"></div>
                </div>

                <div class="status-toggles">
                    <div class="status-item">${lead.intro ? checkIcon : xIcon} Intro Meeting</div>
                    <div class="status-item">${lead.weekly ? checkIcon : xIcon} Weekly Calls</div>
                </div>

                <div class="section-title">CONTACT INFORMATION</div>
                <div class="info-grid">
                    <div class="info-row">
                        <div class="avatar-placeholder">👤</div>
                        <div class="info-text" style="width:100%">
                            <span class="info-label">Customer Contact</span>
                            <div style="display:flex; align-items:center; gap:8px;">
                                ${createEditable('contact', lead.contact, false)}
                                <div style="cursor:pointer" onclick="window.editLinkedIn('${lead.id}')">
                                    ${linkedinBtn}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="info-row">
                        <div class="avatar-placeholder">👤</div>
                        <div class="info-text" style="width:100%">
                            <span class="info-label">Strategic Owner</span>
                            ${createEditable('strategic', lead.strategic, true, state.dropdowns.strategic)}
                        </div>
                    </div>
                </div>

                <div class="section-title">TEAM ASSIGNMENT</div>
                <div class="info-grid">
                    <div class="info-row">
                        <div class="avatar-placeholder">👥</div>
                        <div class="info-text" style="width:100%">
                            <span class="info-label">Management Lead</span>
                            ${createEditable('manager', lead.manager, true, state.dropdowns.managers)}
                        </div>
                    </div>
                    <div class="info-row">
                        <div class="avatar-placeholder">🚚</div>
                        <div class="info-text">
                            <span class="info-label">Delivery Lead</span>
                            ${createEditable('delivery', lead.delivery, true, state.dropdowns.managers)}
                        </div>
                    </div>
                </div>

                <div class="section-title">PIPELINE STATUS (Click to toggle)</div>
                <div class="pipeline-list">
                    ${createPipeRow('PPTs Shared', 'ppts', lead.pipeline.ppts)}
                    ${createPipeRow('Verbal Agreement', 'verbal', lead.pipeline.verbal)}
                    ${createPipeRow('NDA Signed', 'nda', lead.pipeline.nda)}
                    ${createPipeRow('LOI Issued', 'loi_issued', lead.pipeline.loi_issued)}
                    ${createPipeRow('LOI Signed', 'loi_signed', lead.pipeline.loi_signed)}
                    ${createPipeRow('Contract Signed', 'contract', lead.pipeline.contract)}
                    ${createPipeRow('Parts & Spend Received', 'parts', lead.pipeline.parts)}
                </div>

                <div class="section-title">NOTES</div>
                <div class="notes-area">
                    <textarea id="notesArea">${lead.notes}</textarea>
                    <button class="btn btn-outline" style="width:100%; justify-content:center; margin-top:8px;" onclick="window.saveNotes()">Save Notes</button>
                </div>
            </div>
        `;
    }

    // --- GLOBAL FUNCTIONS ---
    function setupGlobalFunctions() {
        
        dom.saveBtn.onclick = () => {
            const lead = state.allLeads.find(l => l.id === state.selectedLeadId);
            if (lead) saveLeadData(lead);
        };

        window.saveNotes = () => {
            const lead = state.allLeads.find(l => l.id === state.selectedLeadId);
            if(lead) {
                lead.notes = document.getElementById('notesArea').value;
                saveLeadData(lead);
            }
        };

        // PIPELINE TOGGLE LOGIC
        window.togglePipeline = (id, key) => {
            const lead = state.allLeads.find(l => l.id === id);
            if(lead) {
                // Toggle Boolean
                lead.pipeline[key] = !lead.pipeline[key];
                
                // Recalculate score logic could go here, or just save
                saveLeadData(lead);
            }
        };

        window.editLinkedIn = (id) => {
            const lead = state.allLeads.find(l => l.id === id);
            const url = prompt("Enter LinkedIn Profile URL:", lead.linkedin || "");
            if (url !== null) {
                lead.linkedin = url;
                saveLeadData(lead);
            }
        };

        window.editSlides = (id) => {
            const lead = state.allLeads.find(l => l.id === id);
            const url = prompt("Enter Google Slides URL:", lead.slides || "");
            if (url !== null) {
                lead.slides = url;
                saveLeadData(lead);
            }
        };

        window.editLogo = (id) => {
            const lead = state.allLeads.find(l => l.id === id);
            const url = prompt("Enter Logo Image URL:", lead.logo || "");
            if (url !== null) {
                lead.logo = url;
                saveLeadData(lead);
            }
        };

        window.enableEdit = (id, field, currentVal, isDropdown, optionsStr) => {
            const container = document.getElementById(`field-${field}`);
            if (isDropdown && optionsStr) {
                const options = optionsStr.split('|');
                let optionsHtml = options.map(opt => `<option value="${opt}" ${opt === currentVal ? 'selected' : ''}>${opt}</option>`).join('');
                optionsHtml = `<option value="Unassigned">Unassigned</option>` + optionsHtml;
                container.innerHTML = `<select class="edit-input" id="input-${field}" onblur="window.finishEdit('${id}', '${field}')">${optionsHtml}</select>`;
            } else {
                container.innerHTML = `<input type="text" class="edit-input" id="input-${field}" value="${currentVal}" onblur="window.finishEdit('${id}', '${field}')" onkeydown="if(event.key==='Enter') window.finishEdit('${id}', '${field}')">`;
            }
            setTimeout(() => document.getElementById(`input-${field}`).focus(), 50);
        };

        window.finishEdit = (id, field) => {
            const input = document.getElementById(`input-${field}`);
            if(!input) return;
            const newVal = input.value;
            const lead = state.allLeads.find(l => l.id === id);
            if(lead) {
                lead[field] = newVal;
                saveLeadData(lead);
            }
        };
    }

    function setupEventListeners() {
        dom.searchInput.addEventListener('input', applyFiltersAndSort);
        dom.refreshBtn.addEventListener('click', fetchData);
        dom.originSelect.addEventListener('change', applyFiltersAndSort);
        dom.typeSelect.addEventListener('change', applyFiltersAndSort);
        dom.managerSelect.addEventListener('change', applyFiltersAndSort);
        dom.stageSelect.addEventListener('change', applyFiltersAndSort);
        Object.keys(dom.sortBtns).forEach(key => {
            const btn = dom.sortBtns[key];
            if(btn) btn.addEventListener('click', () => {
                if (state.sort.field === (key === 'followup' ? 'score' : key)) {
                    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sort.field = (key === 'followup' ? 'score' : key);
                    state.sort.direction = key === 'followup' ? 'desc' : 'asc';
                }
                applyFiltersAndSort();
            });
        });
    }

    // Helper functions (same as before)
    function populateFilters() { /* Same as previous code */ 
        const managers = state.dropdowns.managers;
        dom.managerSelect.innerHTML = '<option value="all">All Managers</option>';
        managers.forEach(m => dom.managerSelect.innerHTML += `<option value="${m}">${m}</option>`);
        const origins = [...new Set(state.allLeads.map(l => l.origin))].filter(o => o).sort();
        dom.originSelect.innerHTML = '<option value="all">All Origins</option>';
        origins.forEach(o => dom.originSelect.innerHTML += `<option value="${o}">${o}</option>`);
    }
    function applyFiltersAndSort() { /* Same as previous code - copy from previous app.js if needed or use full block */ 
        const query = dom.searchInput.value.toLowerCase();
        const originVal = dom.originSelect.value;
        const typeVal = dom.typeSelect.value;
        const managerVal = dom.managerSelect.value;
        const stageVal = dom.stageSelect.value;

        state.filteredLeads = state.allLeads.filter(lead => {
            const matchesSearch = lead.customer.toLowerCase().includes(query) || lead.contact.toLowerCase().includes(query) || lead.notes.toLowerCase().includes(query);
            const matchesOrigin = originVal === 'all' || lead.origin === originVal;
            const matchesManager = managerVal === 'all' || lead.manager === managerVal;
            let matchesType = true;
            if (typeVal !== 'all') {
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

        const { field, direction } = state.sort;
        state.filteredLeads.sort((a, b) => {
            let valA, valB;
            if (field === 'customer') { valA = a.customer.toLowerCase(); valB = b.customer.toLowerCase(); }
            else if (field === 'origin') { valA = a.origin.toLowerCase(); valB = b.origin.toLowerCase(); }
            else if (field === 'manager') { valA = a.manager.toLowerCase(); valB = b.manager.toLowerCase(); }
            else if (field === 'score') { valA = a.score; valB = b.score; }
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        renderList();
    }
    function renderList() { /* Same as previous code */
        dom.listContainer.innerHTML = '';
        dom.listCount.innerText = state.filteredLeads.length;
        dom.totalCount.innerText = state.allLeads.length;
        if (state.filteredLeads.length === 0) { dom.listContainer.innerHTML = '<div class="empty-state">No leads match.</div>'; return; }
        state.filteredLeads.forEach(lead => {
            const row = document.createElement('div');
            row.className = `lead-row ${state.selectedLeadId === lead.id ? 'active' : ''}`;
            row.onclick = () => selectLead(lead.id);
            const tagsHtml = lead.tags.map(t => `<span class="tag tag-${t.type}">${t.text}</span>`).join('');
            const introClass = lead.intro ? 'dot-green' : 'dot-gray';
            const weeklyClass = lead.weekly ? 'dot-green' : 'dot-gray';
            row.innerHTML = `<div class="lead-icon-col"><div class="icon-circle">📄</div></div><div class="lead-content-col"><div class="lead-header-row"><span class="lead-name">${lead.customer}</span>${tagsHtml}</div><div class="lead-notes">${lead.notes}</div></div><div class="lead-meta-col"><div class="status-indicators"><div class="status-dot"><span class="dot ${introClass}"></span> Intro</div><div class="status-dot"><span class="dot ${weeklyClass}"></span> Weekly</div></div><div style="font-size:0.7rem; color:#9ca3af">Win Prob: ${lead.progress}%</div></div>`;
            dom.listContainer.appendChild(row);
        });
    }
    function selectLead(id) { state.selectedLeadId = id; renderList(); const lead = state.allLeads.find(l => l.id === id); renderDetails(lead); }
    function updateTimestamp() { dom.lastUpdated.innerText = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; }
});
