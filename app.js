const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE";

let rows = [];

document.addEventListener("DOMContentLoaded", () => {
  const companySelect = document.getElementById("companySelect");
  const themeToggle = document.getElementById("themeToggle");

  if (!companySelect) {
    console.error("companySelect not found in DOM");
    return;
  }

  // Fetch data
  fetch(API_URL)
    .then(r => r.json())
    .then(data => {
      rows = data;

      data.forEach(row => {
        if (!row["Customer"]) return;
        const opt = document.createElement("option");
        opt.value = row["Customer"];
        opt.textContent = row["Customer"];
        companySelect.appendChild(opt);
      });
    })
    .catch(err => console.error("Fetch error:", err));

  // Dropdown change
  companySelect.addEventListener("change", e => {
    const company = e.target.value;
    if (!company) return;

    const row = rows.find(r => r["Customer"] === company);
    renderCompany(row);
  });

  // Theme toggle (safe)
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  }
});

function renderCompany(d) {
  if (!d) return;

  document.getElementById("customer").textContent =
    "Customer: " + (d["Customer"] || "");

  document.getElementById("leadOrigin").textContent =
    "Lead Origin: " + (d["Lead Origin"] || "");

  document.getElementById("owner").textContent =
    "Strategic Owner: " + (d["Strategic Owner"] || "");

  document.getElementById("notes").textContent =
    d["Current Progress"] || "";

  // Progress badges
  const progressDiv = document.getElementById("progressBadges");
  progressDiv.innerHTML = "";

  ["Introductory Meeting", "NDA Signed", "LOI Signed"].forEach(key => {
    if (!d[key]) return;
    const span = document.createElement("span");
    span.textContent = `${key}: ${d[key]}`;
    progressDiv.appendChild(span);
  });

  // PPT link
  const linkDiv = document.getElementById("pptLink");
  linkDiv.innerHTML = "";

  if (d["Commodities – PPT (Link)"]) {
    const a = document.createElement("a");
    a.href = d["Commodities – PPT (Link)"];
    a.target = "_blank";
    a.textContent = "View PPT";
    linkDiv.appendChild(a);
  }
}
