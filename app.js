const API_URL = "https://script.google.com/macros/library/d/1MTkiGf78O66IAME9rREj4T6hCH7H9NmrIW90Mn77aZE7FySPNq8V-WyK/2";

let rows = [];

fetch(API_URL)
  .then(response => response.json())
  .then(data => {
    rows = data;

    const select = document.getElementById("companySelect");
    const companies = [...new Set(rows.map(r => r.Customer).filter(Boolean))];

    companies.forEach(company => {
      const opt = document.createElement("option");
      opt.value = company;
      opt.textContent = company;
      select.appendChild(opt);
    });

    select.addEventListener("change", () => {
      renderCompany(select.value);
    });
  });

function renderCompany(company) {
  const d = rows.find(r => r.Customer === company);
  if (!d) return;

  document.getElementById("customer").textContent = d.Customer || "";
  document.getElementById("leadOrigin").textContent = d["Lead Origin"] || "";
  document.getElementById("owner").textContent = d["Strategic Owner"] || "";
  document.getElementById("notes").textContent = d["Current Progress"] || "";

  // Progress badges
  const progressDiv = document.getElementById("progressBadges");
  progressDiv.innerHTML = "";

  ["Introductory Meeting", "NDA Signed", "LOI Signed"].forEach(key => {
    const badge = document.createElement("span");
    badge.className = "badge " + (d[key] === "Yes" ? "yes" : "no");
    badge.textContent = key;
    progressDiv.appendChild(badge);
  });

  // CLICKABLE LINK (THIS IS THE FIX)
  const linkDiv = document.getElementById("pptLink");
  linkDiv.innerHTML = "";

  if (d["Commodities – PPT (Link)"]) {
    const a = document.createElement("a");
    a.href = d["Commodities – PPT (Link)"];
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "View PPT";
    linkDiv.appendChild(a);
  }
}
