// DOE MATABIAU App v2 — Logique commune Admin + FCTP + NETPC + Viewer
// Stack: GitHub + JSON (data.json versionné via API) + fichiers dans storage/<rue>/<chapitre>/

const STATUTS = {
  "": { label: "Non démarré", classe: "", couleur: "#607d8b" },
  "X": { label: "Fourni", classe: "X", couleur: "#2e7d32" },
  "P": { label: "Partiel", classe: "P", couleur: "#ef6c00" },
  "R": { label: "Bloqué", classe: "R", couleur: "#c62828" },
  "NA": { label: "N/A", classe: "NA", couleur: "#1565c0" }
};

const ROLES = {
  "admin": { label: "Admin · Mathieu", couleur: "#0b3b8c", peutEcrire: true, filtreChapitres: null },
  "fctp": { label: "FCTP", couleur: "#f28c28", peutEcrire: true, filtreChapitres: "fctp" },
  "netpc": { label: "NETPC", couleur: "#1565c0", peutEcrire: true, filtreChapitres: "netpc" },
  "viewer": { label: "Visibilité", couleur: "#607d8b", peutEcrire: false, filtreChapitres: null }
};

const GITHUB_CONFIG = {
  owner: "bonhommemathieux-ops",
  repo: "doe-matabiau-app",
  branch: "main",
  path: "data.json"
};

let DATA = null;
let TOKEN_GH = null;
let ROLE = "viewer";
let CURRENT_RUE = null;

// --- Helpers rôle ---
function peutEcrire() { return ROLES[ROLE].peutEcrire && TOKEN_GH; }
function peutModifierChapitre(chap) {
  const r = ROLES[ROLE];
  if (!r.peutEcrire) return false;
  if (r.filtreChapitres === null) return true;
  return chap[r.filtreChapitres] === true;
}

// --- Chargement data.json ---
async function chargerData() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.path}?t=${Date.now()}`);
    if (r.ok) { DATA = await r.json(); return; }
  } catch (e) {}
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
function rendreDashboard(container) {
  const stat = statutGlobal();
  document.getElementById("global-pct").textContent = stat + " %";

  const grid = container;
  grid.innerHTML = "";
  for (const rue of DATA.rues) {
    const s = statutRue(rue.code);
    const etat = (DATA.etats && DATA.etats[rue.code]) || {};
    const nbFichiers = Object.values(etat).reduce((n, e) => n + (e.fichiers?.length || 0), 0);
    const card = document.createElement("div");
    card.className = "rue-card " + s.classe;
    card.innerHTML = `
      <div class="code">${rue.code} · ${rue.secteur}</div>
      <div class="nom">${rue.nom}</div>
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span class="pct">${s.pct} %</span>
        <span style="font-size:12px;color:var(--texte-faible);">${s.x}/${s.compte} · 📎 ${nbFichiers}</span>
      </div>
      <div class="barre"><div class="barre-fill" style="width:${s.pct}%"></div></div>
      <div class="mini-chapitres">
        ${DATA.chapitres.map(c => {
          const st = etat[c.id]?.statut || "";
          return `<div class="mini-chapitre ${st}" title="${c.id} ${c.label}: ${STATUTS[st]?.label || 'vide'}"></div>`;
        }).join("")}
      </div>
    `;
    card.onclick = () => ouvrirFiche(rue.code);
    grid.appendChild(card);
  }
}

// --- Modal fiche rue ---
function ouvrirFiche(code) {
  CURRENT_RUE = code;
  const rue = DATA.rues.find(r => r.code === code);
  const etat = (DATA.etats && DATA.etats[code]) || {};
  const modal = document.getElementById("modal");
  const body = document.getElementById("modal-body");
  const s = statutRue(code);

  body.innerHTML = `
    <h2>${rue.code} — ${rue.nom}</h2>
    <div class="subtitle">Secteur ${rue.secteur} · Avancement : <strong>${s.pct} %</strong> · Rôle : <span style="color:${ROLES[ROLE].couleur};font-weight:600;">${ROLES[ROLE].label}</span></div>

    <div class="chapitres-list">
      ${DATA.chapitres.map(c => renderChapitre(c, etat[c.id] || {})).join("")}
    </div>

    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
      <button onclick="genererSommaireDocx('${code}')">📄 Générer sommaire .docx</button>
      ${peutEcrire() ? `<button class="success" onclick="pousserGitHub()">💾 Sauvegarder sur GitHub</button>` : ''}
      <button class="secondary modal-close" onclick="fermerModal()">Fermer</button>
    </div>
  `;
  modal.classList.add("open");
}

function renderChapitre(chap, e) {
  const canEdit = peutModifierChapitre(chap);
  const st = e.statut || "";
  const fichiers = e.fichiers || [];
  const resp = [chap.fctp ? "FCTP" : null, chap.netpc ? "NETPC" : null].filter(Boolean).join(" + ");
  return `
    <div class="chapitre-item ${canEdit ? '' : 'locked'}">
      <div class="chapitre-head">
        <div>
          <strong>${chap.id}. ${chap.label}</strong>
          ${chap.critical ? '<span class="dot-critique" title="Critique">●</span>' : ''}
          <span class="responsable">${resp}</span>
        </div>
        <div class="statut-cell">
          ${canEdit ? `
            <button class="btn-statut ${st === 'X' ? 'active-X' : ''}" onclick="setStatut('${chap.id}','X')">✓ Fourni</button>
            <button class="btn-statut ${st === 'P' ? 'active-P' : ''}" onclick="setStatut('${chap.id}','P')">~ Partiel</button>
            <button class="btn-statut ${st === 'R' ? 'active-R' : ''}" onclick="setStatut('${chap.id}','R')">⚠ Bloqué</button>
            <button class="btn-statut ${st === 'NA' ? 'active-NA' : ''}" onclick="setStatut('${chap.id}','NA')">N/A</button>
            <button class="btn-statut" onclick="setStatut('${chap.id}','')">×</button>
          ` : `<span style="color:${STATUTS[st]?.couleur || '#607d8b'};font-weight:600;">${STATUTS[st]?.label || '—'}</span>`}
        </div>
      </div>
      ${canEdit ? `
        <textarea class="commentaire" onblur="setCommentaire('${chap.id}',this.value)" placeholder="Observations…">${e.commentaire || ''}</textarea>
      ` : (e.commentaire ? `<div class="commentaire-ro">${e.commentaire}</div>` : '')}

      <div class="fichiers-zone">
        <div class="fichiers-list">
          ${fichiers.map((f, i) => `
            <div class="fichier">
              <a href="https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${f.path}" target="_blank">
                ${getIconeFichier(f.name)} ${f.name}
              </a>
              <span class="fichier-meta">${(f.taille / 1024).toFixed(0)} ko · ${f.date} · ${f.auteur}</span>
              ${canEdit ? `<button class="danger btn-mini" onclick="supprimerFichier('${chap.id}',${i})">🗑</button>` : ''}
            </div>
          `).join('')}
        </div>
        ${canEdit ? `
          <label class="upload-zone" ondrop="dropFichier(event,'${chap.id}')" ondragover="event.preventDefault()">
            <input type="file" style="display:none;" multiple onchange="uploadFichiers('${chap.id}',this.files)">
            <span>📎 Déposer un fichier (ou glisser-déposer)</span>
          </label>
        ` : (canEdit === false && peutEcrire() ? `<div class="locked-msg">⛔ Non autorisé pour ${ROLES[ROLE].label}</div>` : '')}
      </div>

      ${e.date ? `<div class="chapitre-date">Dernière màj : ${e.date}${e.auteur ? ' par ' + e.auteur : ''}</div>` : ''}
    </div>
  `;
}

function getIconeFichier(nom) {
  const ext = nom.split('.').pop().toLowerCase();
  if (["pdf"].includes(ext)) return "📕";
  if (["jpg","jpeg","png","gif","webp"].includes(ext)) return "🖼";
  if (["doc","docx"].includes(ext)) return "📘";
  if (["xls","xlsx"].includes(ext)) return "📗";
  if (["dwg","dxf"].includes(ext)) return "📐";
  if (["zip","rar","7z"].includes(ext)) return "📦";
  return "📄";
}

function fermerModal() {
  document.getElementById("modal").classList.remove("open");
  CURRENT_RUE = null;
  if (document.getElementById("grid")) {
    rendreDashboard(document.getElementById("grid"));
  }
}

function setStatut(chapId, statut) {
  if (!DATA.etats) DATA.etats = {};
  if (!DATA.etats[CURRENT_RUE]) DATA.etats[CURRENT_RUE] = {};
  if (!DATA.etats[CURRENT_RUE][chapId]) DATA.etats[CURRENT_RUE][chapId] = {};
  DATA.etats[CURRENT_RUE][chapId].statut = statut;
  DATA.etats[CURRENT_RUE][chapId].date = new Date().toISOString().slice(0, 10);
  DATA.etats[CURRENT_RUE][chapId].auteur = ROLES[ROLE].label;
  ouvrirFiche(CURRENT_RUE);
}

function setCommentaire(chapId, texte) {
  if (!DATA.etats) DATA.etats = {};
  if (!DATA.etats[CURRENT_RUE]) DATA.etats[CURRENT_RUE] = {};
  if (!DATA.etats[CURRENT_RUE][chapId]) DATA.etats[CURRENT_RUE][chapId] = {};
  DATA.etats[CURRENT_RUE][chapId].commentaire = texte;
  DATA.etats[CURRENT_RUE][chapId].date = new Date().toISOString().slice(0, 10);
  DATA.etats[CURRENT_RUE][chapId].auteur = ROLES[ROLE].label;
}

// --- Upload fichiers via GitHub Contents API ---
async function uploadFichiers(chapId, files) {
  if (!TOKEN_GH) { toast("Token requis pour upload", true); return; }
  for (const f of files) {
    await uploadUnFichier(chapId, f);
  }
  ouvrirFiche(CURRENT_RUE);
}

function dropFichier(evt, chapId) {
  evt.preventDefault();
  uploadFichiers(chapId, evt.dataTransfer.files);
}

async function uploadUnFichier(chapId, file) {
  if (file.size > 24 * 1024 * 1024) {
    toast(`${file.name} : > 24 Mo, limite GitHub Contents API`, true);
    return;
  }
  toast(`Upload ${file.name}…`);
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onload = async () => {
      const b64 = reader.result.split(",")[1];
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `storage/${CURRENT_RUE}/${chapId}/${timestamp}_${safeName}`;
      const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
      try {
        const r = await fetch(url, {
          method: "PUT",
          headers: { Authorization: `token ${TOKEN_GH}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Upload ${file.name} dans ${CURRENT_RUE} chap ${chapId} (${ROLES[ROLE].label})`,
            content: b64,
            branch: GITHUB_CONFIG.branch
          })
        });
        if (r.ok) {
          if (!DATA.etats) DATA.etats = {};
          if (!DATA.etats[CURRENT_RUE]) DATA.etats[CURRENT_RUE] = {};
          if (!DATA.etats[CURRENT_RUE][chapId]) DATA.etats[CURRENT_RUE][chapId] = {};
          if (!DATA.etats[CURRENT_RUE][chapId].fichiers) DATA.etats[CURRENT_RUE][chapId].fichiers = [];
          DATA.etats[CURRENT_RUE][chapId].fichiers.push({
            name: file.name,
            path: path,
            taille: file.size,
            date: new Date().toISOString().slice(0, 10),
            auteur: ROLES[ROLE].label
          });
          DATA.etats[CURRENT_RUE][chapId].date = new Date().toISOString().slice(0, 10);
          await pousserGitHub(true);
          toast(`${file.name} ajouté ✓`);
        } else {
          const err = await r.json();
          toast(`Erreur upload : ${err.message}`, true);
        }
      } catch (e) {
        toast("Erreur réseau : " + e.message, true);
      }
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

async function supprimerFichier(chapId, index) {
  if (!confirm("Supprimer ce fichier ?")) return;
  const f = DATA.etats[CURRENT_RUE][chapId].fichiers[index];
  if (!f) return;
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${f.path}`;
  try {
    const rGet = await fetch(url + `?ref=${GITHUB_CONFIG.branch}`, {
      headers: { Authorization: `token ${TOKEN_GH}` }
    });
    if (!rGet.ok) throw new Error("fichier introuvable");
    const j = await rGet.json();
    const rDel = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `token ${TOKEN_GH}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Suppression ${f.name} (${ROLES[ROLE].label})`,
        sha: j.sha,
        branch: GITHUB_CONFIG.branch
      })
    });
    if (rDel.ok) {
      DATA.etats[CURRENT_RUE][chapId].fichiers.splice(index, 1);
      await pousserGitHub(true);
      ouvrirFiche(CURRENT_RUE);
      toast("Supprimé ✓");
    }
  } catch (e) {
    toast("Erreur : " + e.message, true);
  }
}

// --- Sauvegarde data.json sur GitHub ---
async function pousserGitHub(silencieux = false) {
  if (!TOKEN_GH) {
    toast("Token GitHub manquant", true);
    return;
  }
  DATA.meta.updated = new Date().toISOString().slice(0, 10);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(DATA, null, 2))));
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
  try {
    const rGet = await fetch(url + `?ref=${GITHUB_CONFIG.branch}`, {
      headers: { Authorization: `token ${TOKEN_GH}` }
    });
    let sha = null;
    if (rGet.ok) sha = (await rGet.json()).sha;
    const rPut = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `token ${TOKEN_GH}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Màj DOE partiel ${new Date().toISOString().slice(0, 10)} (${ROLES[ROLE].label})`,
        content: content,
        branch: GITHUB_CONFIG.branch,
        sha: sha
      })
    });
    if (rPut.ok) {
      if (!silencieux) toast("Sauvegardé sur GitHub ✓");
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

  const headerDash = ["Code", "Rue", "Secteur", ...DATA.chapitres.map(c => `${c.id}. ${c.label}`), "Fichiers", "%", "Statut"];
  const rowsDash = [headerDash];
  for (const rue of DATA.rues) {
    const s = statutRue(rue.code);
    const etat = (DATA.etats && DATA.etats[rue.code]) || {};
    const chapStats = DATA.chapitres.map(c => etat[c.id]?.statut || "");
    const nbFichiers = Object.values(etat).reduce((n, e) => n + (e.fichiers?.length || 0), 0);
    let st = "⚪ Non démarré";
    if (s.r > 0) st = "🔴 Bloqué";
    else if (s.pct === 100) st = "🟢 Complet";
    else if (s.pct > 0) st = "🟠 En cours";
    rowsDash.push([rue.code, rue.nom, rue.secteur, ...chapStats, nbFichiers, s.pct + "%", st]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(rowsDash);
  XLSX.utils.book_append_sheet(wb, ws1, "Dashboard");

  const headerSuivi = ["Code rue", "Rue", "Chapitre", "Statut", "Date", "Auteur", "Fichiers", "Commentaire"];
  const rowsSuivi = [headerSuivi];
  for (const rue of DATA.rues) {
    const etat = (DATA.etats && DATA.etats[rue.code]) || {};
    for (const c of DATA.chapitres) {
      const e = etat[c.id] || {};
      const stLabel = STATUTS[e.statut || ""]?.label || "Non démarré";
      const fichiers = (e.fichiers || []).map(f => f.name).join(" | ");
      rowsSuivi.push([rue.code, rue.nom, `${c.id}. ${c.label}`, stLabel, e.date || "", e.auteur || "", fichiers, e.commentaire || ""]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsSuivi), "Suivi détaillé");

  const headerRecap = ["Chapitre", "Responsable", "Fournis (X)", "Partiels (~)", "Bloqués", "N/A", "Non démarrés", "Fichiers"];
  const rowsRecap = [headerRecap];
  for (const c of DATA.chapitres) {
    let x = 0, p = 0, r = 0, na = 0, vide = 0, nbF = 0;
    for (const rue of DATA.rues) {
      const e = (DATA.etats?.[rue.code]?.[c.id]) || {};
      const s = e.statut || "";
      if (s === "X") x++;
      else if (s === "P") p++;
      else if (s === "R") r++;
      else if (s === "NA") na++;
      else vide++;
      nbF += (e.fichiers?.length || 0);
    }
    const resp = [c.fctp ? "FCTP" : null, c.netpc ? "NETPC" : null].filter(Boolean).join(" + ");
    rowsRecap.push([`${c.id}. ${c.label}`, resp, x, p, r, na, vide, nbF]);
  }
  rowsRecap.push([]);
  rowsRecap.push(["Global", "", "", "", "", "", "", statutGlobal() + "%"]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsRecap), "Récap");

  const nom = `Suivi_DOE_Partiel_MATABIAU_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, nom);
  toast("Excel généré: " + nom);
}

// --- Génération sommaire .docx ---
function genererSommaireDocx(code) {
  const rue = DATA.rues.find(r => r.code === code);
  const etat = (DATA.etats && DATA.etats[code]) || {};
  const s = statutRue(code);
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>DOE Partiel ${rue.nom}</title></head><body>
<div style="font-family:Calibri;">
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  <tr>
    <td style="border:1px solid #000;padding:8px;width:30%;"><strong>FCTP + NETPC</strong></td>
    <td style="border:1px solid #000;padding:8px;">MOA : ${DATA.meta.moa}<br>MOE : ${DATA.meta.moe}<br>Projet : ${DATA.meta.project}</td>
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
    <th style="padding:6px;border:1px solid #000;">Resp.</th>
    <th style="padding:6px;border:1px solid #000;">Statut</th>
    <th style="padding:6px;border:1px solid #000;">Fichiers</th>
    <th style="padding:6px;border:1px solid #000;">Observations</th>
  </tr>
  ${DATA.chapitres.map(c => {
    const e = etat[c.id] || {};
    const st = STATUTS[e.statut || ""]?.label || "—";
    const resp = [c.fctp ? "FCTP" : null, c.netpc ? "NETPC" : null].filter(Boolean).join(" + ");
    const fichiers = (e.fichiers || []).map(f => f.name).join("<br>") || "—";
    return `<tr>
      <td style="padding:6px;border:1px solid #000;">${c.id}</td>
      <td style="padding:6px;border:1px solid #000;">${c.label}</td>
      <td style="padding:6px;border:1px solid #000;">${resp}</td>
      <td style="padding:6px;border:1px solid #000;">${st}</td>
      <td style="padding:6px;border:1px solid #000;font-size:10px;">${fichiers}</td>
      <td style="padding:6px;border:1px solid #000;">${e.commentaire || ''}</td>
    </tr>`;
  }).join("")}
</table>
<p style="margin-top:24px;font-size:11px;color:#666;">Généré le ${new Date().toLocaleString('fr-FR')} · DOE_MATABIAU_App</p>
</div></body></html>`;
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
