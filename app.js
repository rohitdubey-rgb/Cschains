// ====== Put your Apps Script Web App URL here ======
const API_URL = "https://script.google.com/macros/s/AKfycbwsIP0OipyJRA6uG6dmvMO4RdiOSegyVOaIfXovR0HJpyRnlq0DmzLG1Bh0GtEishLvtA/exec";

let rows = [];

fetch(API_URL)
  .then(resp => resp.json())
  .then(data => {
    if (!Array.isArray(data)) {
      console.error("Unexpected API data:", data);
      return;
    }
    rows = data;

    const select = document.getElementById("companySelect");
    select.innerHTML = '<option value="">Select a company</option>';

    rows.forEach(r => {
      if (!r["Customer"]) return;
      const opt = document.createElement("option");
      opt.value = r["Customer"];
      opt.textContent = r["Customer"];
      select.appendChild(opt);
    });
  })
  .catch(err => console.error("Fetch failed:", err));

document.getElementById("companySelect").addEventListener("change", () => {
  const company = document.getElementById("companySelect").value;
  const row = rows.find(r => r["Customer"] === company);
  renderCompany(row);
});

function renderCompany(d) {
  if (!d) return;

  document.getElementById("customer").textContent = d["Customer"] || "";
  document.getElementById("leadOrigin").textContent = d["Lead Origin"] || "";
  document.getElementById("owner").textContent = d["Strategic Owner"] || "";
  document.getElementById("notes").textContent = d["Current Progress"] || "";

  const progressDiv = document.getElementById("progressBadges");
  progressDiv.innerHTML = "";
  ["Introductory Meeting", "NDA Signed", "LOI Signed"].forEach(key => {
    if (d[key]) {
      const badge = document.createElement("span");
      badge.textContent = key + ": " + d[key];
      progressDiv.appendChild(badge);
    }
  });

  const linkDiv = document.getElementById("pptLink");
  linkDiv.innerHTML = "";
  if (d["Commodities – PPT (Link)"]) {
    const a = document.createElement("a");
    a.href = d["Commodities – PPT (Link)"];
    a.target = "_blank";
    a.textContent = "Open Document";
    linkDiv.appendChild(a);
  }
}
