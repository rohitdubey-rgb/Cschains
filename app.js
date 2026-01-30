// app.js
// Client-side logic: fetch data, render UI, charts, search/typeahead, actions.
// IMPORTANT: Set API_URL to the deployed Apps Script web app URL.

const API_URL = "https://script.google.com/macros/s/AKfycbwsIP0OipyJRA6uG6dmvMO4RdiOSegyVOaIfXovR0HJpyRnlq0DmzLG1Bh0GtEishLvtA/exec"; // e.g. https://script.google.com/macros/s/AKfyc.../exec

// State
let rows = [];
let companies = [];
let charts = {
  phaseChart: null,
  pipelineChart: null
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  // Elements
  const companySelect = document.getElementById("companySelect");
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");

  // Fetch once and set up UI
  fetchData().then(() => {
    populateSelect();
    setupEvents();
    renderPipelineOverview();
  }).catch(err => {
    console.error("Data load error:", err);
    alert("Unable to load data from API. Check Apps Script deployment and CORS/public access.");
  });

  function setupEvents() {
    companySelect.addEventListener("change", () => {
      const val = companySelect.value;
      selectCompany(val);
    });

    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        // reset options
        populateSelect();
        return;
      }
      // filter companies, show top 10
      const filtered = companies.filter(c => c.toLowerCase().includes(q)).slice(0, 30);
      // if exact match, select it
      const exact = filtered.find(x => x.toLowerCase() === q);
      if (exact) {
        selectCompany(exact);
        companySelect.value = exact;
      } else {
        // rebuild select options with filtered
        buildSelectOptions(filtered);
      }
    });

    // Theme toggle (simple)
    themeToggle.addEventListener("click", () => {
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      if (dark) {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    });

    // Tab behavior
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", (ev) => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        ev.currentTarget.classList.add("active");
        const tabName = ev.currentTarget.dataset.tab;
        document.querySelectorAll(".tabContent").forEach(c => c.classList.add("hidden"));
        const toShow = document.getElementById(tabName);
        if (toShow) toShow.classList.remove("hidden");
      });
    });

    // Actions
    document.getElementById("downloadJSON").addEventListener("click", downloadCurrentJSON);
    document.getElementById("copyLink").addEventListener("click", copyPageLink);
  }
}

// Fetches all rows from Apps Script JSON
async function fetchData() {
  const resp = await fetch(API_URL, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error("Network response not ok: " + resp.status);
  }
  const data = await resp.json();
  if (!Array.isArray(data)) {
    // Could be wrapped error
    if (data && data.error) throw new Error(data.message || "API returned error");
    throw new Error("Unexpected API response");
  }
  rows = data.map(normalizeRowKeys);
  companies = [...new Set(rows.map(r => (r.customer || r.customer_name || r.name || "").toString().trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}

// Normalizes row keys (defensive)
function normalizeRowKeys(r) {
  const out = {};
  for (const k in r) {
    if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
    const lk = k.toString().toLowerCase();
    out[lk] = r[k];
  }
  // Also provide canonical aliases
  if (!out.customer && out.customer_name) out.customer = out.customer_name;
  if (!out.customer && out.name) out.customer = out.name;
  return out;
}

function populateSelect() {
  const sel = document.getElementById("companySelect");
  buildSelectOptions(companies);
}

function buildSelectOptions(list) {
  const sel = document.getElementById("companySelect");
  sel.innerHTML = '<option value="">Select a company</option>';
  list.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

// Select a company and render details
function selectCompany(company) {
  if (!company) {
    clearDetails();
    return;
  }

  // Find row case-insensitive
  const d = rows.find(r => (r.customer || "").toString().trim().toLowerCase() === company.toString().trim().toLowerCase());
  if (!d) {
    clearDetails();
    return;
  }
  renderCompany(d);
  // Update URL so it can be shared
  history.replaceState(null, "", `${location.pathname}?company=${encodeURIComponent(company)}`);
}

function clearDetails() {
  ["customer", "leadOrigin", "owner", "notes", "pilotInfo", "pptLink", "progressBadges"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
  // clear charts
  if (charts.phaseChart) {
    charts.phaseChart.destroy();
    charts.phaseChart = null;
  }
}

function renderCompany(d) {
  document.getElementById("customer").textContent = d.customer || "";
  document.getElementById("leadOrigin").textContent = d.lead_origin || d.lead || "";
  document.getElementById("owner").textContent = d.strategic_owner || d.owner || "";

  document.getElementById("notes").innerHTML = sanitizeHtml(d.current_progress || d.notes || "");

  // Progress badges - determine presence by common keys
  const progressKeys = [
    {key: "introductory_meeting", label: "Intro Meeting"},
    {key: "ppt_shared", label: "PPT Shared"},
    {key: "verbal_agreement", label: "Verbal Agreement"},
    {key: "nda_signed", label: "NDA Signed"},
    {key: "loi_issued", label: "LOI Issued"},
    {key: "loi_signed", label: "LOI Signed"}
  ];

  const progressDiv = document.getElementById("progressBadges");
  progressDiv.innerHTML = "";
  progressKeys.forEach(pk => {
    if (d[pk.key] === undefined && d[pk.label.toLowerCase().replace(/\s+/g, "_")] === undefined) {
      // try other heuristics: key exactly exists or not; we still render if we find value
    }
    const value = (d[pk.key] || d[pk.label.toLowerCase().replace(/\s+/g, "_")] || "").toString().trim().toLowerCase();
    const span = document.createElement("span");
    span.className = "badge " + (value === "yes" || value === "y" || value === "true" ? "yes" : "no");
    span.textContent = pk.label + (value ? ` • ${value}` : "");
    progressDiv.appendChild(span);
  });

  // Pilot & delivery
  const pilotDiv = document.getElementById("pilotInfo");
  pilotDiv.innerHTML = "";
  const deliveryLead = d.delivery_lead || d.delivery || d.delivery_leader;
  if (deliveryLead) {
    const p = document.createElement("p");
    p.innerHTML = `<strong>Delivery Lead:</strong> ${escapeHtml(deliveryLead)}`;
    pilotDiv.appendChild(p);
  }
  if (d.current_progress) {
    const p2 = document.createElement("p");
    p2.innerHTML = `<strong>Current Progress:</strong> ${escapeHtml(d.current_progress)}`;
    pilotDiv.appendChild(p2);
  }

  // Documents / PPT link
  const linkDiv = document.getElementById("pptLink");
  linkDiv.innerHTML = "";
  const linkVal = d.commodities_ppt_link || d["commodities_-_ppt_(link)"] || d["commodities_ppt_link"] || d.ppt_link || d.ppt;
  if (linkVal) {
    const a = document.createElement("a");
    a.href = linkVal.toString().trim();
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Open PPT / Document";
    linkDiv.appendChild(a);
  } else {
    linkDiv.textContent = "No document link available";
  }

  // Phase chart (small)
  renderPhaseChart(d);

  // Scroll to top of details
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPhaseChart(d) {
  // Destroy existing
  if (charts.phaseChart) {
    charts.phaseChart.destroy();
    charts.phaseChart = null;
  }

  const ctx = document.getElementById("phaseChart").getContext("2d");
  // Map a few possible keys to numeric 0-100
  const phaseValue = Number(d.phase_0 || d.phase || d.progress_percent || 0) || 0;
  const display = Math.max(0, Math.min(100, phaseValue));
  charts.phaseChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Complete", "Remaining"],
      datasets: [{
        data: [display, 100 - display],
        backgroundColor: ["#23b79b", "#f3f4f6"]
      }]
    },
    options: {
      cutout: "80%",
      plugins: { legend: { display: false } }
    }
  });
}

function renderPipelineOverview() {
  // Build simple counts by phase (from rows)
  const counts = { phase0: 0, phase1: 0, phase2: 0, unknown: 0 };
  rows.forEach(r => {
    const p = (r.phase_0 || r.phase || r["phase"] || "").toString().trim();
    if (p === "0" || p.toLowerCase() === "phase0" || p.toLowerCase() === "phase_0") counts.phase0++;
    else if (p === "1" || p.toLowerCase() === "phase1" || p.toLowerCase() === "phase_1") counts.phase1++;
    else if (p === "2" || p.toLowerCase() === "phase2" || p.toLowerCase() === "phase_2") counts.phase2++;
    else counts.unknown++;
  });

  const ctx = document.getElementById("pipelineChart").getContext("2d");
  if (charts.pipelineChart) charts.pipelineChart.destroy();
  charts.pipelineChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Phase 0","Phase 1","Phase 2","Unknown"],
      datasets: [{ label: "Count", data: [counts.phase0, counts.phase1, counts.phase2, counts.unknown], backgroundColor: ["#23b79b","#62d2b0","#9feadf","#e6eef0"] }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Download current company JSON
function downloadCurrentJSON() {
  const sel = document.getElementById("companySelect");
  const company = sel.value;
  if (!company) return alert("Select a company first");
  const row = rows.find(r => (r.customer || "").toString().trim().toLowerCase() === company.toString().trim().toLowerCase());
  if (!row) return alert("No data found for selected company");

  const blob = new Blob([JSON.stringify(row, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${company.replace(/\s+/g,"_")}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Copy sharable URL for current company
function copyPageLink() {
  const sel = document.getElementById("companySelect");
  const company = sel.value;
  if (!company) return alert("Select company first");
  const url = `${location.origin}${location.pathname}?company=${encodeURIComponent(company)}`;
  navigator.clipboard.writeText(url).then(()=> alert("Link copied to clipboard"), ()=> alert("Copy failed"));
}

// Utility: escape HTML
function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s).replace(/[&<>"'`=\/]/g, function(chr) {
    return "&#" + chr.charCodeAt(0) + ";";
  });
}

// Sanitize minimal HTML (allow <br>)
function sanitizeHtml(str) {
  if (!str) return "";
  return escapeHtml(str).replace(/\n/g, "<br/>");
}
