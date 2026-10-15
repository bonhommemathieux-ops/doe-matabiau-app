// DOE MATABIAU App — Logique commune Admin + Viewer
// Stack: GitHub + JSON (data.json versionné via API)

const STATUTS = {
  "": { label: "Non démarré", classe: "", couleur: "#607d8b" },
  "X": { label: "Fourni", classe: "X", couleur: "#2e7d32" },
  "P": { label: "Partiel", classe: "P", couleur: "#ef6c00" },
  "R": { label: "Bloqué", classe: "R", couleur: "#c62828" },
  "NA": { label: "N/A", classe: "NA", couleur: "#1565c0" }
};

// --- Configuration GitHub (à adapter) ---
// Pour l'instant lecture directe du data.json local, écriture via API quand GitHub configuré
const GITHUB_CONFIG = {
  owner: "bonhommemathieux-ops",
  repo: "doe-matabiau-app",
  branch: "main",
  path: "data.json"
};

let DATA = null;
let MODE_ADMIN = false;
let TOKEN_GH = null;
let CURRENT_RUE = null;

// --- Chargement data.json ---
async function chargerData() {
  // Tente d'abord GitHub (si repo publié), sinon local
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.path}?t=${Date.now()}`);
    if (r.ok) {
      DATA = await r.json();
      return;
    }
  } catch (e) { /* fallback local */ }
  const r2 = await fetch(`data.json?t=${Date.now()}`);
  DATA = await r2.json();
}

// --- Calculs d'avancement ---
function statutRue(code) {
  const etat = (DATA.etats && DATA.etats[code]) || {};
  let x = 0, p = 0, na = 0, r = 0, total = 0;
  for (const chap of DATA.chapitres) {
    const s = etat[chap.id]?.statut || "";
    if (s === "X") x++;
    else if (s === "P") p++;
    else if (s === "NA") na++;
    else if (s === "R") r++;
    total++;
  }
  const compte = total - na;
  const pct = compte === 0 ? 100 : Math.round(((x + p * 0.5) / compte) * 100);
  let classe = "";
  if (r > 0) classe = "statut-rouge";
  else if (pct === 100) classe = "statut-vert";
  else if (pct > 0) classe = "statut-orange";
  else classe = "";
  return { x, p, na, r, total, compte, pct, classe };
}

function statutGlobal() {
  let somme = 0;
  for (const rue of DATA.rues) somme += statutRue(rue.code).pct;
  return Math.round(somme / DATA.rues.length);
}

function compterStatut(statut) {
  return DATA.rues.filter(r => {
    const s = statutRue(r.code);
    if (statut === "complete") return s.pct === 100 && s.r === 0;
    if (statut === "cours") return s.pct > 0 && s.pct < 100 && s.r === 0;
    if (statut === "bloque") return s.r > 0;
    if (statut === "vide") return s.pct === 0 && s.r === 0;
  }).length;
}

// --- Rendu dashboard ---
function rendreDashboard(container, admin) {
  const stat = statutGlobal();
  document.getElementById("global-pct").textContent = stat + " %";

  const grid = container;
  grid.innerHTML = "";
  for (const rue of DATA.rues) {
    const s = statutRue(rue.code);
    const etat = (DATA.etats && DATA.etats[rue.code]) || {};
    const card = document.createElement("div");
    card.className = "rue-card " + s.classe;
    card.innerHTML = `
      <div class="code">${rue.code} · ${rue.secteur}</div>
      <div class="nom">${rue.nom}</div>
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span class="pct">${s.pct} %</span>
        <span style="font-size:12px;color:var(--texte-faible);">${s.x}/${s.compte} fournis${s.na ? ` · ${s.na} N/A` : ''}${s.r ? ` · ${s.r} bloqué` : ''}</span>
      </div>
      <div class="barre"><div class="barre-fill" style="width:${s.pct}%"></div></div>
      <div class="mini-chapitres">
        ${DATA.chapitres.map(c => {
          const st = etat[c.id]?.statut || "";
          return `<div class="mini-chapitre ${st}" title="${c.id} ${c.label}: ${STATUTS[st]?.label || 'vide'}"></div>`;
        }).join("")}
      </div>
    `;
    card.onclick = () => ouvrirFiche(rue.code, admin);
    grid.appendChild(card);
  }
}

// --- Modal fiche rue ---
function ouvrirFiche(code, admin) {
  CURRENT_RUE = code;
  const rue = DATA.rues.find(r => r.code === code);
  const etat = (DATA.etats && DATA.etats[code]) || {};
  const modal = document.getElementById("modal");
  const body = document.getElementById("modal-body");
  const s = statutRue(code);

  body.innerHTML = `
    <h2>${rue.code} — ${rue.nom}</h2>
    <div class="subtitle">Secteur ${rue.secteur} · Avancement : <strong>${s.pct} %</strong></div>

    <table class="chapitres">
      <thead>
        <tr><th>#</th><th>Chapitre</th><th>Statut</th><th>Commentaire</th><th>Date</th></tr>
      </thead>
      <tbody>
        ${DATA.chapitres.map(c => {
          const e = etat[c.id] || {};
          const st = e.statut || "";
          return `
            <tr data-chap="${c.id}">
              <td>${c.id}</td>
              <td>${c.label}${c.critical ? ' <span style="color:var(--rouge);">●</span>' : ''}</td>
              <td class="statut-cell">
                ${admin ? `
                  <button class="btn-statut ${st === 'X' ? 'active-X' : ''}" onclick="setStatut('${c.id}','X')">✓</button>
                  <button class="btn-statut ${st === 'P' ? 'active-P' : ''}" onclick="setStatut('${c.id}','P')">~</button>
                  <button class="btn-statut ${st === 'R' ? 'active-R' : ''}" onclick="setStatut('${c.id}','R')">⚠</button>
                  <button class="btn-statut ${st === 'NA' ? 'active-NA' : ''}" onclick="setStatut('${c.id}','NA')">N/A</button>
                  <button class="btn-statut" onclick="setStatut('${c.id}','')">×</button>
                ` : `<span style="font-weight:600;color:${STATUTS[st]?.couleur || '#607d8b'}">${STATUTS[st]?.label || '—'}</span>`}
              </td>
              <td>
                ${admin ? `<textarea class="commentaire" onblur="setCommentaire('${c.id}',this.value)" placeholder="Observations…">${e.commentaire || ''}</textarea>`
                        : `<span>${e.commentaire || '—'}</span>`}
              </td>
              <td style="font-size:11px;color:var(--texte-faible);">${e.date || ''}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>

    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
      <button onclick="genererSommaireDocx('${code}')">📄 Générer sommaire .docx</button>
      ${admin ? `<button class="success" onclick="pousserGitHub()">💾 Sauvegarder sur GitHub</button>` : ''}
      <button class="secondary modal-close" onclick="fermerModal()">Fermer</button>
    </div>
  `;
  modal.classList.add("open");
}

function fermerModal() {
  document.getElementById("modal").classList.remove("open");
  CURRENT_RUE = null;
  rendreDashboard(document.getElementById("grid"), MODE_ADMIN);
}

function setStatut(chapId, statut) {
  if (!DATA.etats) DATA.etats = {};
  if (!DATA.etats[CURRENT_RUE]) DATA.etats[CURRENT_RUE] = {};
  if (!DATA.etats[CURRENT_RUE][chapId]) DATA.etats[CURRENT_RUE][chapId] = {};
  DATA.etats[CURRENT_RUE][chapId].statut = statut;
  DATA.etats[CURRENT_RUE][chapId].date = new Date().toISOString().slice(0, 10);
  ouvrirFiche(CURRENT_RUE, true);
}

function setCommentaire(chapId, texte) {
  if (!DATA.etats) DATA.etats = {};
  if (!DATA.etats[CURRENT_RUE]) DATA.etats[CURRENT_RUE] = {};
  if (!DATA.etats[CURRENT_RUE][chapId]) DATA.etats[CURRENT_RUE][chapId] = {};
  DATA.etats[CURRENT_RUE][chapId].commentaire = texte;
  DATA.etats[CURRENT_RUE][chapId].date = new Date().toISOString().slice(0, 10);
}

// --- Sauvegarde GitHub (admin uniquement) ---
async function pousserGitHub() {
  if (!TOKEN_GH) {
    toast("Token GitHub manquant", true);
    return;
  }
  DATA.meta.updated = new Date().toISOString().slice(0, 10);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(DATA, null, 2))));
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
  try {
    // Récupérer le sha actuel
    const rGet = await fetch(url + `?ref=${GITHUB_CONFIG.branch}`, {
      headers: { Authorization: `token ${TOKEN_GH}` }
    });
    let sha = null;
    if (rGet.ok) {
      const j = await rGet.json();
      sha = j.sha;
    }
    const rPut = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${TOKEN_GH}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Màj DOE partiel ${new Date().toISOString().slice(0, 10)}`,
        content: content,
        branch: GITHUB_CONFIG.branch,
        sha: sha
      })
    });
    if (rPut.ok) {
      toast("Sauvegardé sur GitHub ✓");
    } else {
      const err = await rPut.json();
      toast("Erreur: " + err.message, true);
    }
  } catch (e) {
    toast("Erreur réseau: " + e.message, true);
  }
}

// --- Export Excel (SheetJS) ---
function genererExcel() {
  const wb = XLSX.utils.book_new();

  // Onglet 1: Dashboard
  const headerDash = ["Code", "Rue", "Secteur", ...DATA.chapitres.map(c => `${c.id}. ${c.label}`), "%", "Statut"];
  const rowsDash = [headerDash];
  for (const rue of DATA.rues) {
    const s = statutRue(rue.code);
    const etat = (DATA.etats && DATA.etats[rue.code]) || {};
    const chapStats = DATA.chapitres.map(c => etat[c.id]?.statut || "");
    let st = "⚪ Non démarré";
    if (s.r > 0) st = "🔴 Bloqué";
    else if (s.pct === 100) st = "🟢 Complet";
    else if (s.pct > 0) st = "🟠 En cours";
    rowsDash.push([rue.code, rue.nom, rue.secteur, ...chapStats, s.pct + "%", st]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(rowsDash);
  XLSX.utils.book_append_sheet(wb, ws1, "Dashboard");

  // Onglet 2: Suivi détaillé
  const headerSuivi = ["Code rue", "Rue", "Chapitre", "Statut", "Date", "Commentaire"];
  const rowsSuivi = [headerSuivi];
  for (const rue of DATA.rues) {
    const etat = (DATA.etats && DATA.etats[rue.code]) || {};
    for (const c of DATA.chapitres) {
      const e = etat[c.id] || {};
      const stLabel = STATUTS[e.statut || ""]?.label || "Non démarré";
      rowsSuivi.push([rue.code, rue.nom, `${c.id}. ${c.label}`, stLabel, e.date || "", e.commentaire || ""]);
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(rowsSuivi);
  XLSX.utils.book_append_sheet(wb, ws2, "Suivi détaillé");

  // Onglet 3: Récap par chapitre
  const headerRecap = ["Chapitre", "Fournis (X)", "Partiels (~)", "Bloqués", "N/A", "Non démarrés", "Rues totales"];
  const rowsRecap = [headerRecap];
  for (const c of DATA.chapitres) {
    let x = 0, p = 0, r = 0, na = 0, vide = 0;
    for (const rue of DATA.rues) {
      const s = (DATA.etats?.[rue.code]?.[c.id]?.statut) || "";
      if (s === "X") x++;
      else if (s === "P") p++;
      else if (s === "R") r++;
      else if (s === "NA") na++;
      else vide++;
    }
    rowsRecap.push([`${c.id}. ${c.label}`, x, p, r, na, vide, DATA.rues.length]);
  }
  rowsRecap.push([]);
  rowsRecap.push(["Global", "", "", "", "", "", statutGlobal() + "%"]);
  const ws3 = XLSX.utils.aoa_to_sheet(rowsRecap);
  XLSX.utils.book_append_sheet(wb, ws3, "Récap");

  const nom = `Suivi_DOE_Partiel_MATABIAU_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, nom);
  toast("Excel généré: " + nom);
}

// --- Export sommaire .docx (très simplifié: HTML téléchargé en .doc) ---
function genererSommaireDocx(code) {
  const rue = DATA.rues.find(r => r.code === code);
  const etat = (DATA.etats && DATA.etats[code]) || {};
  const s = statutRue(code);
  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DOE Partiel ${rue.nom}</title></head><body>
<div style="font-family:Calibri;">
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  <tr>
    <td style="border:1px solid #000;padding:8px;width:30%;"><strong>FCTP</strong><br>${DATA.meta.entreprise}</td>
    <td style="border:1px solid #000;padding:8px;">
      MOA : ${DATA.meta.moa}<br>
      MOE : ${DATA.meta.moe}<br>
      Projet : ${DATA.meta.project}
    </td>
  </tr>
</table>

<h1 style="color:#0b3b8c;text-align:center;">DOE PARTIEL</h1>
<h2 style="text-align:center;">${rue.code} — ${rue.nom}</h2>
<p style="text-align:center;">Secteur ${rue.secteur} · Avancement : <strong>${s.pct} %</strong></p>

<table style="width:100%;border-collapse:collapse;margin-top:12px;">
  <tr style="background:#0b3b8c;color:#fff;">
    <th style="padding:6px;border:1px solid #000;">Indice</th>
    <th style="padding:6px;border:1px solid #000;">Date</th>
    <th style="padding:6px;border:1px solid #000;">Rédacteur</th>
    <th style="padding:6px;border:1px solid #000;">Objet</th>
  </tr>
  <tr>
    <td style="padding:6px;border:1px solid #000;">${DATA.meta.indice}</td>
    <td style="padding:6px;border:1px solid #000;">${new Date().toLocaleDateString('fr-FR')}</td>
    <td style="padding:6px;border:1px solid #000;">${DATA.meta.redacteur}</td>
    <td style="padding:6px;border:1px solid #000;">Première diffusion</td>
  </tr>
</table>

<h3 style="color:#0b3b8c;margin-top:24px;">Sommaire</h3>
<table style="width:100%;border-collapse:collapse;">
  <tr style="background:#f28c28;color:#fff;">
    <th style="padding:6px;border:1px solid #000;">#</th>
    <th style="padding:6px;border:1px solid #000;">Chapitre</th>
    <th style="padding:6px;border:1px solid #000;">Statut</th>
    <th style="padding:6px;border:1px solid #000;">Observations</th>
  </tr>
  ${DATA.chapitres.map(c => {
    const e = etat[c.id] || {};
    const st = STATUTS[e.statut || ""]?.label || "—";
    return `<tr>
      <td style="padding:6px;border:1px solid #000;">${c.id}</td>
      <td style="padding:6px;border:1px solid #000;">${c.label}</td>
      <td style="padding:6px;border:1px solid #000;">${st}</td>
      <td style="padding:6px;border:1px solid #000;">${e.commentaire || ''}</td>
    </tr>`;
  }).join("")}
</table>

<p style="margin-top:24px;font-size:11px;color:#666;">Généré le ${new Date().toLocaleString('fr-FR')} · DOE_MATABIAU_App</p>
</div>
</body></html>`;

  const blob = new Blob([html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DOE_Partiel_${rue.code}_${rue.nom.replace(/[^\w]+/g, '_')}.doc`;
  a.click();
  toast("Sommaire généré");
}

// --- Toast ---
function toast(msg, erreur = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (erreur ? " error" : "");
  setTimeout(() => t.className = "toast", 2500);
}
