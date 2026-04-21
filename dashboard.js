window.Dashboard = (function () {
    let dashboardContainer;

    function init(containerId) {
        dashboardContainer = document.getElementById(containerId);
    }

    function render(leads) {
        if (!dashboardContainer) return;

        const activeLeads = leads.filter(l => !l.dead && !l.successful);
        const successfulLeads = leads.filter(l => l.successful);
        const deadLeads = leads.filter(l => l.dead);
        const totalLeads = leads.length;

        // Statistics
        const avgProb = activeLeads.length ? Math.round(activeLeads.reduce((sum, l) => sum + l.progress, 0) / activeLeads.length) : 0;
        const conversionRate = totalLeads ? Math.round((successfulLeads.length / totalLeads) * 100) : 0;

        // Phase Distribution
        const p1Count = activeLeads.filter(l => l.phase === 1).length;
        const p2Count = activeLeads.filter(l => l.phase === 2).length;
        const p3Count = activeLeads.filter(l => l.phase === 3).length;

        // Manager Distribution
        const managers = [...new Set(leads.map(l => l.manager))].filter(Boolean);
        const managerStats = managers.map(m => {
            return { name: m, count: leads.filter(l => l.manager === m && !l.dead && !l.successful).length };
        }).sort((a, b) => b.count - a.count);

        // Origin Distribution
        const origins = [...new Set(leads.map(l => l.origin))].filter(Boolean);
        const originStats = origins.map(o => {
            return { name: o, count: leads.filter(l => l.origin === o).length };
        }).sort((a, b) => b.count - a.count);

        dashboardContainer.innerHTML = `
            <div class="bento-grid">
                <div class="bento-card bento-stat">
                    <div class="stat-label">Active Pipeline</div>
                    <div class="stat-value">${activeLeads.length}</div>
                    <div class="stat-sub">Leads in progress</div>
                </div>
                <div class="bento-card bento-stat">
                    <div class="stat-label">Avg. Win Probability</div>
                    <div class="stat-value">${avgProb}%</div>
                    <div class="stat-sub">Across active pipeline</div>
                </div>
                <div class="bento-card bento-stat">
                    <div class="stat-label">Conversion Rate</div>
                    <div class="stat-value">${conversionRate}%</div>
                    <div class="stat-sub">${successfulLeads.length} of ${totalLeads} closed</div>
                </div>
                <div class="bento-card bento-stat">
                    <div class="stat-label">Successful Projects</div>
                    <div class="stat-value" style="color: #16a34a">${successfulLeads.length}</div>
                    <div class="stat-sub">Completed deals</div>
                </div>

                <div class="bento-card bento-medium">
                    <div class="chart-header">Pipeline Funnel (Active)</div>
                    <div class="funnel-container" style="gap: 10px;">
                        ${renderFunnelRow('Phase 1', p1Count, activeLeads.length, 'var(--p1-color)')}
                        ${renderFunnelRow('Phase 2', p2Count, activeLeads.length, 'var(--p2-color)')}
                        ${renderFunnelRow('Phase 3', p3Count, activeLeads.length, 'var(--p3-color)')}
                    </div>
                </div>

                <div class="bento-card bento-medium">
                    <div class="chart-header">Manager Workload (Active)</div>
                    <div class="bar-list" style="max-height: 180px; overflow-y: auto; padding-right: 5px;">
                        ${managerStats.map(m => renderUserRow(m.name, m.count, activeLeads.length)).join('')}
                    </div>
                </div>

                <div class="bento-card bento-wide">
                    <div class="chart-header">Lead Origins</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; max-height: 120px; overflow-y: auto;">
                        ${originStats.map(o => renderDataRow(o.name, o.count)).join('')}
                    </div>
                </div>

                <div class="bento-card bento-stat">
                    <div class="chart-header" style="margin-bottom:15px">Outcomes</div>
                    <div class="pie-summary">
                        ${renderPieItem('Success', successfulLeads.length, totalLeads, 'pill-success')}
                        ${renderPieItem('Active', activeLeads.length, totalLeads, 'pill-active')}
                        ${renderPieItem('Dead', deadLeads.length, totalLeads, 'pill-dead')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderUserRow(name, count, total) {
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2);
        const percent = total ? Math.round((count / total) * 100) : 0;
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
        const color = colors[Math.abs(name.length) % colors.length];

        return `
            <div class="data-row">
                <div class="avatar-stack">
                    <div class="avatar-circle" style="background:${color}">${initials}</div>
                    <span class="data-label">${name}</span>
                </div>
                <span class="data-value">${count}</span>
            </div>
        `;
    }

    function renderDataRow(label, value) {
        return `
            <div class="data-row">
                <span class="data-label">${label}</span>
                <span class="data-value" style="color: var(--text-secondary)">${value}</span>
            </div>
        `;
    }

    function renderFunnelRow(label, count, total, color) {
        const percent = total ? Math.round((count / total) * 100) : 0;
        return `
            <div class="funnel-row" style="gap: 4px;">
                <div class="funnel-label" style="font-size: 0.75rem;"><span>${label}</span> <span>${count}</span></div>
                <div class="funnel-bar-bg" style="height: 10px;">
                    <div class="funnel-bar-fill" style="width: ${percent}%; background-color: ${color}"></div>
                </div>
            </div>
        `;
    }

    function renderProgressBar(label, count, total) {
        const percent = total ? Math.round((count / total) * 100) : 0;
        return `
            <div class="bar-item">
                <div class="bar-info"><span>${label}</span> <span>${count}</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: ${percent}%"></div></div>
            </div>
        `;
    }

    function renderPieItem(label, count, total, badgeClass) {
        const percent = total ? Math.round((count / total) * 100) : 0;
        return `
            <div class="data-row">
                <span class="pill-badge ${badgeClass}">${label}</span>
                <span class="data-value" style="color:var(--text-tertiary)">${percent}%</span>
            </div>
        `;
    }

    return { init, render };
})();
