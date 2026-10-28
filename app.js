// DOE MATABIAU App v4 — Sommaire MOE Antoine GUYOT (GTA ENERGIES) 27/10/2026
// Structure : DOE COMMUN par secteur (8 chap) + DOE par TRONÇON (6 chap × 21 tronçons)
// Stack: GitHub + JSON (data.json versionné via API) + fichiers dans storage/

const STATUTS = {
  "": { label: "Non démarré", classe: "", couleur: "#607d8b" },
  "X": { label: "Fourni", classe: "X", couleur: "#2e7d32" },
  "P": { label: "Partiel", classe: "P", couleur: "#ef6c00" },
  "R": { label: "Bloqué", classe: "R", couleur: "#c62828" },
  "NA": { label: "N/A", classe: "NA", couleur: "#1565c0" }
};

const ROLES = {
  "admin": { label: "Admin · Mathieu", couleur: "#0b3b8c", peutEcrire: true },
  "viewer": { label: "Visibilité", couleur: "#607d8b", peutEcrire: false }
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
let CURRENT_SCOPE = null;   // {kind: "commun"|"troncon", id: "S2"|"S2-01"}

function peutEcrire() { return ROLES[ROLE].peutEcrire && TOKEN_GH; }

// --- Chargement data.json ---
async function chargerData() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.path}?t=${Date.now()}`);
    if (r.ok) { DATA = await r.json(); return; }
  } catch (e) {}
  const r2 = await fetch(`data.json?t=${Date.now()}`);
  DATA = await r2.json();
}

// --- Accès état ---
function getEtatCommun(secteurId, chapId) {
  return DATA.etats?.commun?.[secteurId]?.[chapId] || {};
}
function setEtatCommun(secteurId, chapId, patch) {
  if (!DATA.etats) DATA.etats = { commun: {}, troncon: {} };
  if (!DATA.etats.commun) DATA.etats.commun = {};
  if (!DATA.etats.commun[secteurId]) DATA.etats.commun[secteurId] = {};
  if (!DATA.etats.commun[secteurId][chapId]) DATA.etats.commun[secteurId][chapId] = {};
  Object.assign(DATA.etats.commun[secteurId][chapId], patch);
}
function getEtatTroncon(code, chapId) {
  return DATA.etats?.troncon?.[code]?.[chapId] || {};
}
function setEtatTroncon(code, chapId, patch) {
  if (!DATA.etats) DATA.etats = { commun: {}, troncon: {} };
  if (!DATA.etats.troncon) DATA.etats.troncon = {};
  if (!DATA.etats.troncon[code]) DATA.etats.troncon[code] = {};
  if (!DATA.etats.troncon[code][chapId]) DATA.etats.troncon[code][chapId] = {};
  Object.assign(DATA.etats.troncon[code][chapId], patch);
}

// --- Calculs d'avancement ---
function statutCommun(secteurId) {
  let x = 0, p = 0, na = 0, r = 0, total = 0, nbFichiers = 0;
  for (const chap of DATA.chapitres_commun) {
    const e = getEtatCommun(secteurId, chap.id);
    const s = e.statut || "";
    if (s === "X") x++;
    else if (s === "P") p++;
    else if (s === "NA") na++;
    else if (s === "R") r++;
    total++;
    nbFichiers += e.fichiers?.length || 0;
  }
  const compte = total - na;
  const pct = compte === 0 ? 100 : Math.round(((x + p * 0.5) / compte) * 100);
  let classe = "";
  if (r > 0) classe = "statut-rouge";
  else if (pct === 100) classe = "statut-vert";
  else if (pct > 0) classe = "statut-orange";
  return { x, p, na, r, total, compte, pct, classe, nbFichiers };
}

function statutRue(code) {
  let x = 0, p = 0, na = 0, r = 0, total = 0, nbFichiers = 0;
  for (const chap of DATA.chapitres_troncon) {
    const e = getEtatTroncon(code, chap.id);
    const s = e.statut || "";
    if (s === "X") x++;
    else if (s === "P") p++;
    else if (s === "NA") na++;
    else if (s === "R") r++;
    total++;
    nbFichiers += e.fichiers?.length || 0;
  }
  const compte = total - na;
  const pct = compte === 0 ? 100 : Math.round(((x + p * 0.5) / compte) * 100);
  let classe = "";
  if (r > 0) classe = "statut-rouge";
  else if (pct === 100) classe = "statut-vert";
  else if (pct > 0) classe = "statut-orange";
  return { x, p, na, r, total, compte, pct, classe, nbFichiers };
}

function statutGlobal() {
  let somme = 0, nb = 0;
  for (const sec of DATA.secteurs) { somme += statutCommun(sec.id).pct; nb++; }
  for (const rue of DATA.rues) { somme += statutRue(rue.code).pct; nb++; }
  return nb === 0 ? 0 : Math.round(somme / nb);
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
  const pctEl = document.getElementById("global-pct");
  if (pctEl) pctEl.textContent = statutGlobal() + " %";
  container.innerHTML = "";

  // --- Section 1 : DOE COMMUN par secteur ---
  const h1 = document.createElement("h2");
  h1.className = "dash-section-title";
  h1.innerHTML = `<span class="dash-section-pill" style="background:#0b3b8c;">COMMUN</span> DOE par secteur <span class="dash-section-info">(1 DOE / secteur · 8 chapitres)</span>`;
  container.appendChild(h1);
  const gridCommun = document.createElement("div");
  gridCommun.className = "dashboard-sub-grid";
  for (const sec of DATA.secteurs) {
    const s = statutCommun(sec.id);
    const card = document.createElement("div");
    card.className = "rue-card commun-card " + s.classe;
    card.style.borderTop = `4px solid ${sec.couleur}`;

    const minis = DATA.chapitres_commun.map(c => {
      const st = getEtatCommun(sec.id, c.id).statut || "";
      return `<div class="mini-chapitre ${st}" title="${c.id} ${c.label}: ${STATUTS[st]?.label || 'vide'}"></div>`;
    }).join("");

    card.innerHTML = `
      <div class="code" style="color:${sec.couleur};">${sec.label}</div>
      <div class="nom">DOE RCU TER ${sec.label}</div>
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span class="pct">${s.pct} %</span>
        <span style="font-size:12px;color:var(--texte-faible);">${s.x}/${s.compte} · 📎 ${s.nbFichiers}</span>
      </div>
      <div class="barre"><div class="barre-fill" style="width:${s.pct}%"></div></div>
      <div class="mini-chapitres" style="display:flex;gap:4px;flex-wrap:wrap;">${minis}</div>
    `;
    card.onclick = () => ouvrirFicheCommun(sec.id);
    gridCommun.appendChild(card);
  }
  container.appendChild(gridCommun);

  // --- Section 2 : DOE PAR TRONÇON ---
  const h2 = document.createElement("h2");
  h2.className = "dash-section-title";
  h2.innerHTML = `<span class="dash-section-pill" style="background:#2e7d32;">TRONÇONS</span> DOE par tronçon <span class="dash-section-info">(${DATA.rues.length} tronçons · 6 chapitres)</span>`;
  container.appendChild(h2);
  const gridTroncon = document.createElement("div");
  gridTroncon.className = "dashboard-sub-grid";
  for (const rue of DATA.rues) {
    const s = statutRue(rue.code);
    const card = document.createElement("div");
    card.className = "rue-card " + s.classe;

    const minis = DATA.chapitres_troncon.map(c => {
      const st = getEtatTroncon(rue.code, c.id).statut || "";
      return `<div class="mini-chapitre ${st}" title="${c.id} ${c.label}: ${STATUTS[st]?.label || 'vide'}"></div>`;
    }).join("");

    card.innerHTML = `
      <div class="code">${rue.code} · ${rue.secteur}</div>
      <div class="nom">${rue.nom}</div>
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span class="pct">${s.pct} %</span>
        <span style="font-size:12px;color:var(--texte-faible);">${s.x}/${s.compte} · 📎 ${s.nbFichiers}</span>
      </div>
      <div class="barre"><div class="barre-fill" style="width:${s.pct}%"></div></div>
      <div class="mini-chapitres" style="display:flex;gap:4px;">${minis}</div>
    `;
    card.onclick = () => ouvrirFicheTroncon(rue.code);
    gridTroncon.appendChild(card);
  }
  container.appendChild(gridTroncon);
}

// --- Modal fiche commun secteur ---
function ouvrirFicheCommun(secteurId) {
  CURRENT_SCOPE = { kind: "commun", id: secteurId };
  const sec = DATA.secteurs.find(s => s.id === secteurId);
  const modal = document.getElementById("modal");
  const body = document.getElementById("modal-body");
  const st = statutCommun(secteurId);

  // Grouper chap par section
  const sections = DATA.sections_commun.map(section => {
    const chaps = DATA.chapitres_commun.filter(c => c.section === section.id);
    return `
      <div class="lot-section" style="border-left:4px solid ${section.couleur};padding-left:12px;margin:16px 0;">
        <h3 style="color:${section.couleur};margin:0 0 4px 0;">
          ${section.id}. ${section.label}
        </h3>
        <div class="chapitres-list">
          ${chaps.map(c => renderChapCommun(secteurId, c)).join("")}
        </div>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <h2 style="color:${sec.couleur};">DOE RCU TER ${sec.label} — COMMUN</h2>
    <div class="subtitle">
      Partie commune au secteur · Avancement : <strong>${st.pct} %</strong>
      · 📎 ${st.nbFichiers} fichier${st.nbFichiers > 1 ? 's' : ''}
      · Rôle : <span style="color:${ROLES[ROLE].couleur};font-weight:600;">${ROLES[ROLE].label}</span>
    </div>

    ${sections}

    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;position:sticky;bottom:0;background:#fff;padding:12px 0;border-top:1px solid #eee;">
      <button onclick="genererSommaireDocxCommun('${secteurId}')">📄 Générer sommaire .docx</button>
      ${peutEcrire() ? `<button class="success" onclick="pousserGitHub()">💾 Sauvegarder sur GitHub</button>` : ''}
      <button class="secondary modal-close" onclick="fermerModal()">Fermer</button>
    </div>
  `;
  modal.classList.add("open");
}

function renderChapCommun(secteurId, chap) {
  const e = getEtatCommun(secteurId, chap.id);
  const canEdit = peutEcrire();
  const st = e.statut || "";
  const fichiers = e.fichiers || [];
  return `
    <div class="chapitre-item">
      <div class="chapitre-head">
        <div><strong>${chap.id}. ${chap.label}</strong></div>
        <div class="statut-cell">
          ${canEdit ? `
            <button class="btn-statut ${st === 'X' ? 'active-X' : ''}" onclick="setStatutCommun('${secteurId}','${chap.id}','X')">✓ Fourni</button>
            <button class="btn-statut ${st === 'P' ? 'active-P' : ''}" onclick="setStatutCommun('${secteurId}','${chap.id}','P')">~ Partiel</button>
            <button class="btn-statut ${st === 'R' ? 'active-R' : ''}" onclick="setStatutCommun('${secteurId}','${chap.id}','R')">⚠ Bloqué</button>
            <button class="btn-statut ${st === 'NA' ? 'active-NA' : ''}" onclick="setStatutCommun('${secteurId}','${chap.id}','NA')">N/A</button>
            <button class="btn-statut" onclick="setStatutCommun('${secteurId}','${chap.id}','')">×</button>
          ` : `<span style="color:${STATUTS[st]?.couleur || '#607d8b'};font-weight:600;">${STATUTS[st]?.label || '—'}</span>`}
        </div>
      </div>
      ${canEdit ? `
        <textarea class="commentaire" onblur="setCommentaireCommun('${secteurId}','${chap.id}',this.value)" placeholder="Observations…">${e.commentaire || ''}</textarea>
      ` : (e.commentaire ? `<div class="commentaire-ro">${e.commentaire}</div>` : '')}

      <div class="fichiers-zone">
        <div class="fichiers-list">
          ${fichiers.map((f, i) => `
            <div class="fichier">
              <a href="https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${f.path}" target="_blank">
                ${getIconeFichier(f.name)} ${f.name}
              </a>
              <span class="fichier-meta">${(f.taille / 1024).toFixed(0)} ko · ${f.date} · ${f.auteur}</span>
              ${canEdit ? `<button class="danger btn-mini" onclick="supprimerFichierCommun('${secteurId}','${chap.id}',${i})">🗑</button>` : ''}
            </div>
          `).join('')}
        </div>
        ${canEdit ? `
          <label class="upload-zone" ondrop="dropFichierCommun(event,'${secteurId}','${chap.id}')" ondragover="event.preventDefault()">
            <input type="file" style="display:none;" multiple onchange="uploadFichiersCommun('${secteurId}','${chap.id}',this.files)">
            <span>📎 Déposer un fichier (ou glisser-déposer)</span>
          </label>
        ` : ''}
      </div>

      ${e.date ? `<div class="chapitre-date">Dernière màj : ${e.date}${e.auteur ? ' par ' + e.auteur : ''}</div>` : ''}
    </div>
  `;
}

// --- Modal fiche tronçon ---
function ouvrirFicheTroncon(code) {
  CURRENT_SCOPE = { kind: "troncon", id: code };
  const rue = DATA.rues.find(r => r.code === code);
  const modal = document.getElementById("modal");
  const body = document.getElementById("modal-body");
  const st = statutRue(code);

  const sections = DATA.sections_troncon.map(section => {
    const chaps = DATA.chapitres_troncon.filter(c => c.section === section.id);
    return `
      <div class="lot-section" style="border-left:4px solid ${section.couleur};padding-left:12px;margin:16px 0;">
        <h3 style="color:${section.couleur};margin:0 0 4px 0;">${section.id}. ${section.label}</h3>
        <div class="chapitres-list">
          ${chaps.map(c => renderChapTroncon(code, c)).join("")}
        </div>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <h2>${rue.code} — ${rue.nom}</h2>
    <div class="subtitle">
      DOE tronçon · Secteur ${rue.secteur} · Avancement : <strong>${st.pct} %</strong>
      · 📎 ${st.nbFichiers} fichier${st.nbFichiers > 1 ? 's' : ''}
      · Rôle : <span style="color:${ROLES[ROLE].couleur};font-weight:600;">${ROLES[ROLE].label}</span>
    </div>

    ${sections}

    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;position:sticky;bottom:0;background:#fff;padding:12px 0;border-top:1px solid #eee;">
      <button onclick="genererSommaireDocxTroncon('${code}')">📄 Générer sommaire .docx</button>
      ${peutEcrire() ? `<button class="success" onclick="pousserGitHub()">💾 Sauvegarder sur GitHub</button>` : ''}
      <button class="secondary modal-close" onclick="fermerModal()">Fermer</button>
    </div>
  `;
  modal.classList.add("open");
}

function renderChapTroncon(code, chap) {
  const e = getEtatTroncon(code, chap.id);
  const canEdit = peutEcrire();
  const st = e.statut || "";
  const fichiers = e.fichiers || [];
  return `
    <div class="chapitre-item">
      <div class="chapitre-head">
        <div><strong>${chap.id}. ${chap.label}</strong></div>
        <div class="statut-cell">
          ${canEdit ? `
            <button class="btn-statut ${st === 'X' ? 'active-X' : ''}" onclick="setStatutTroncon('${code}','${chap.id}','X')">✓ Fourni</button>
            <button class="btn-statut ${st === 'P' ? 'active-P' : ''}" onclick="setStatutTroncon('${code}','${chap.id}','P')">~ Partiel</button>
            <button class="btn-statut ${st === 'R' ? 'active-R' : ''}" onclick="setStatutTroncon('${code}','${chap.id}','R')">⚠ Bloqué</button>
            <button class="btn-statut ${st === 'NA' ? 'active-NA' : ''}" onclick="setStatutTroncon('${code}','${chap.id}','NA')">N/A</button>
            <button class="btn-statut" onclick="setStatutTroncon('${code}','${chap.id}','')">×</button>
          ` : `<span style="color:${STATUTS[st]?.couleur || '#607d8b'};font-weight:600;">${STATUTS[st]?.label || '—'}</span>`}
        </div>
      </div>
      ${canEdit ? `
        <textarea class="commentaire" onblur="setCommentaireTroncon('${code}','${chap.id}',this.value)" placeholder="Observations…">${e.commentaire || ''}</textarea>
      ` : (e.commentaire ? `<div class="commentaire-ro">${e.commentaire}</div>` : '')}

      <div class="fichiers-zone">
        <div class="fichiers-list">
          ${fichiers.map((f, i) => `
            <div class="fichier">
              <a href="https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${f.path}" target="_blank">
                ${getIconeFichier(f.name)} ${f.name}
              </a>
              <span class="fichier-meta">${(f.taille / 1024).toFixed(0)} ko · ${f.date} · ${f.auteur}</span>
              ${canEdit ? `<button class="danger btn-mini" onclick="supprimerFichierTroncon('${code}','${chap.id}',${i})">🗑</button>` : ''}
            </div>
          `).join('')}
        </div>
        ${canEdit ? `
          <label class="upload-zone" ondrop="dropFichierTroncon(event,'${code}','${chap.id}')" ondragover="event.preventDefault()">
            <input type="file" style="display:none;" multiple onchange="uploadFichiersTroncon('${code}','${chap.id}',this.files)">
            <span>📎 Déposer un fichier (ou glisser-déposer)</span>
          </label>
        ` : ''}
      </div>

      ${e.date ? `<div class="chapitre-date">Dernière màj : ${e.date}${e.auteur ? ' par ' + e.auteur : ''}</div>` : ''}
    </div>
  `;
}

// Alias pour compat viewer.html
function ouvrirFiche(code) { ouvrirFicheTroncon(code); }

function getIconeFichier(nom) {
  const ext = nom.split('.').pop().toLowerCase();
  if (["pdf"].includes(ext)) return "📕";
  if (["jpg","jpeg","png","gif","webp"].includes(ext)) return "🖼";
  if (["doc","docx"].includes(ext)) return "📘";
  if (["xls","xlsx"].includes(ext)) return "📗";
  if (["dwg","dxf"].includes(ext)) return "📐";
  if (["shp","shx","dbf"].includes(ext)) return "🗺";
  if (["zip","rar","7z"].includes(ext)) return "📦";
  return "📄";
}

function fermerModal() {
  document.getElementById("modal").classList.remove("open");
  CURRENT_SCOPE = null;
  if (document.getElementById("grid")) rendreDashboard(document.getElementById("grid"));
}

// --- Setters statut / commentaire ---
function setStatutCommun(secteurId, chapId, statut) {
  setEtatCommun(secteurId, chapId, {
    statut,
    date: new Date().toISOString().slice(0, 10),
    auteur: ROLES[ROLE].label
  });
  ouvrirFicheCommun(secteurId);
}
function setCommentaireCommun(secteurId, chapId, texte) {
  setEtatCommun(secteurId, chapId, {
    commentaire: texte,
    date: new Date().toISOString().slice(0, 10),
    auteur: ROLES[ROLE].label
  });
}
function setStatutTroncon(code, chapId, statut) {
  setEtatTroncon(code, chapId, {
    statut,
    date: new Date().toISOString().slice(0, 10),
    auteur: ROLES[ROLE].label
  });
  ouvrirFicheTroncon(code);
}
function setCommentaireTroncon(code, chapId, texte) {
  setEtatTroncon(code, chapId, {
    commentaire: texte,
    date: new Date().toISOString().slice(0, 10),
    auteur: ROLES[ROLE].label
  });
}

// --- Upload fichiers ---
async function uploadFichiersCommun(secteurId, chapId, files) {
  if (!TOKEN_GH) { toast("Token requis pour upload", true); return; }
  for (const f of files) await uploadUnFichier("commun", secteurId, chapId, f);
  ouvrirFicheCommun(secteurId);
}
function dropFichierCommun(evt, secteurId, chapId) {
  evt.preventDefault();
  uploadFichiersCommun(secteurId, chapId, evt.dataTransfer.files);
}
async function uploadFichiersTroncon(code, chapId, files) {
  if (!TOKEN_GH) { toast("Token requis pour upload", true); return; }
  for (const f of files) await uploadUnFichier("troncon", code, chapId, f);
  ouvrirFicheTroncon(code);
}
function dropFichierTroncon(evt, code, chapId) {
  evt.preventDefault();
  uploadFichiersTroncon(code, chapId, evt.dataTransfer.files);
}

async function uploadUnFichier(kind, scopeId, chapId, file) {
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
      const path = `storage/${kind}/${scopeId}/${chapId}/${timestamp}_${safeName}`;
      const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
      try {
        const r = await fetch(url, {
          method: "PUT",
          headers: { Authorization: `token ${TOKEN_GH}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Upload ${file.name} dans ${kind}/${scopeId}/${chapId} (${ROLES[ROLE].label})`,
            content: b64,
            branch: GITHUB_CONFIG.branch
          })
        });
        if (r.ok) {
          const e = kind === "commun" ? getEtatCommun(scopeId, chapId) : getEtatTroncon(scopeId, chapId);
          const fichiers = e.fichiers || [];
          fichiers.push({
            name: file.name,
            path: path,
            taille: file.size,
            date: new Date().toISOString().slice(0, 10),
            auteur: ROLES[ROLE].label
          });
          const patch = {
            fichiers,
            date: new Date().toISOString().slice(0, 10),
            auteur: ROLES[ROLE].label
          };
          if (kind === "commun") setEtatCommun(scopeId, chapId, patch);
          else setEtatTroncon(scopeId, chapId, patch);
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

async function supprimerFichierCommun(secteurId, chapId, index) {
  await supprimerFichierGeneric("commun", secteurId, chapId, index);
}
async function supprimerFichierTroncon(code, chapId, index) {
  await supprimerFichierGeneric("troncon", code, chapId, index);
}
async function supprimerFichierGeneric(kind, scopeId, chapId, index) {
  if (!confirm("Supprimer ce fichier ?")) return;
  const e = kind === "commun" ? getEtatCommun(scopeId, chapId) : getEtatTroncon(scopeId, chapId);
  const f = e.fichiers?.[index];
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
      e.fichiers.splice(index, 1);
      await pousserGitHub(true);
      if (kind === "commun") ouvrirFicheCommun(scopeId); else ouvrirFicheTroncon(scopeId);
      toast("Supprimé ✓");
    }
  } catch (e) {
    toast("Erreur : " + e.message, true);
  }
}

// --- Sauvegarde data.json sur GitHub ---
async function pousserGitHub(silencieux = false) {
  if (!TOKEN_GH) { toast("Token GitHub manquant", true); return; }
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
        message: `Màj DOE ${new Date().toISOString().slice(0, 10)} (${ROLES[ROLE].label})`,
        content: content,
        branch: GITHUB_CONFIG.branch,
        sha: sha
      })
    });
    if (rPut.ok) { if (!silencieux) toast("Sauvegardé sur GitHub ✓"); }
    else {
      const err = await rPut.json();
      toast("Erreur: " + err.message, true);
    }
  } catch (e) {
    toast("Erreur réseau: " + e.message, true);
  }
}

// --- Export Excel ---
function genererExcel() {
  const wb = XLSX.utils.book_new();

  // Onglet DOE COMMUN
  const headerC = ["Secteur", ...DATA.chapitres_commun.map(c => `${c.id} ${c.label}`), "Fichiers", "%", "Statut"];
  const rowsC = [headerC];
  for (const sec of DATA.secteurs) {
    const s = statutCommun(sec.id);
    const chaps = DATA.chapitres_commun.map(c => getEtatCommun(sec.id, c.id).statut || "");
    let st = "⚪ Non démarré";
    if (s.r > 0) st = "🔴 Bloqué";
    else if (s.pct === 100) st = "🟢 Complet";
    else if (s.pct > 0) st = "🟠 En cours";
    rowsC.push([sec.label, ...chaps, s.nbFichiers, s.pct + "%", st]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsC), "DOE Commun");

  // Onglet DOE TRONÇONS
  const headerT = ["Code", "Tronçon", "Secteur", ...DATA.chapitres_troncon.map(c => `${c.id} ${c.label}`), "Fichiers", "%", "Statut"];
  const rowsT = [headerT];
  for (const rue of DATA.rues) {
    const s = statutRue(rue.code);
    const chaps = DATA.chapitres_troncon.map(c => getEtatTroncon(rue.code, c.id).statut || "");
    let st = "⚪ Non démarré";
    if (s.r > 0) st = "🔴 Bloqué";
    else if (s.pct === 100) st = "🟢 Complet";
    else if (s.pct > 0) st = "🟠 En cours";
    rowsT.push([rue.code, rue.nom, rue.secteur, ...chaps, s.nbFichiers, s.pct + "%", st]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsT), "DOE Tronçons");

  // Onglet détail fichiers
  const headerD = ["Portée", "Scope", "Chapitre", "Statut", "Date", "Auteur", "Fichier", "Commentaire"];
  const rowsD = [headerD];
  for (const sec of DATA.secteurs) {
    for (const c of DATA.chapitres_commun) {
      const e = getEtatCommun(sec.id, c.id);
      const stLabel = STATUTS[e.statut || ""]?.label || "Non démarré";
      const fichiers = (e.fichiers || []).map(f => f.name);
      if (fichiers.length === 0) {
        rowsD.push(["COMMUN", sec.label, `${c.id}. ${c.label}`, stLabel, e.date || "", e.auteur || "", "", e.commentaire || ""]);
      } else {
        for (const fn of fichiers) {
          rowsD.push(["COMMUN", sec.label, `${c.id}. ${c.label}`, stLabel, e.date || "", e.auteur || "", fn, e.commentaire || ""]);
        }
      }
    }
  }
  for (const rue of DATA.rues) {
    for (const c of DATA.chapitres_troncon) {
      const e = getEtatTroncon(rue.code, c.id);
      const stLabel = STATUTS[e.statut || ""]?.label || "Non démarré";
      const fichiers = (e.fichiers || []).map(f => f.name);
      const scope = `${rue.code} ${rue.nom}`;
      if (fichiers.length === 0) {
        rowsD.push(["TRONÇON", scope, `${c.id}. ${c.label}`, stLabel, e.date || "", e.auteur || "", "", e.commentaire || ""]);
      } else {
        for (const fn of fichiers) {
          rowsD.push(["TRONÇON", scope, `${c.id}. ${c.label}`, stLabel, e.date || "", e.auteur || "", fn, e.commentaire || ""]);
        }
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsD), "Détail fichiers");

  const nom = `Suivi_DOE_MATABIAU_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, nom);
  toast("Excel généré: " + nom);
}

// --- Génération sommaire .docx ---
function genererSommaireDocxCommun(secteurId) {
  const sec = DATA.secteurs.find(s => s.id === secteurId);
  const st = statutCommun(secteurId);
  const sections = DATA.sections_commun.map(section => {
    const chaps = DATA.chapitres_commun.filter(c => c.section === section.id);
    const rows = chaps.map(c => {
      const e = getEtatCommun(secteurId, c.id);
      const s = STATUTS[e.statut || ""]?.label || "—";
      const fichiers = (e.fichiers || []).map(f => f.name).join("<br>") || "—";
      return `<tr>
        <td style="padding:6px;border:1px solid #000;">${c.id}</td>
        <td style="padding:6px;border:1px solid #000;">${c.label}</td>
        <td style="padding:6px;border:1px solid #000;">${s}</td>
        <td style="padding:6px;border:1px solid #000;font-size:10px;">${fichiers}</td>
        <td style="padding:6px;border:1px solid #000;">${e.commentaire || ''}</td>
      </tr>`;
    }).join("");
    return `
      <h3 style="color:${section.couleur};margin-top:24px;">${section.id}. ${section.label}</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:${section.couleur};color:#fff;">
          <th style="padding:6px;border:1px solid #000;">#</th>
          <th style="padding:6px;border:1px solid #000;">Chapitre</th>
          <th style="padding:6px;border:1px solid #000;">Statut</th>
          <th style="padding:6px;border:1px solid #000;">Fichiers</th>
          <th style="padding:6px;border:1px solid #000;">Observations</th>
        </tr>
        ${rows}
      </table>
    `;
  }).join("");

  const html = buildDocHtml(`DOE RCU TER ${sec.label} — COMMUN`, `Partie commune au secteur ${sec.label}`, st.pct, sections);
  telechargerDoc(`DOE_Commun_${sec.id}_${new Date().toISOString().slice(0,10)}.doc`, html);
}

function genererSommaireDocxTroncon(code) {
  const rue = DATA.rues.find(r => r.code === code);
  const st = statutRue(code);
  const sections = DATA.sections_troncon.map(section => {
    const chaps = DATA.chapitres_troncon.filter(c => c.section === section.id);
    const rows = chaps.map(c => {
      const e = getEtatTroncon(code, c.id);
      const s = STATUTS[e.statut || ""]?.label || "—";
      const fichiers = (e.fichiers || []).map(f => f.name).join("<br>") || "—";
      return `<tr>
        <td style="padding:6px;border:1px solid #000;">${c.id}</td>
        <td style="padding:6px;border:1px solid #000;">${c.label}</td>
        <td style="padding:6px;border:1px solid #000;">${s}</td>
        <td style="padding:6px;border:1px solid #000;font-size:10px;">${fichiers}</td>
        <td style="padding:6px;border:1px solid #000;">${e.commentaire || ''}</td>
      </tr>`;
    }).join("");
    return `
      <h3 style="color:${section.couleur};margin-top:24px;">${section.id}. ${section.label}</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:${section.couleur};color:#fff;">
          <th style="padding:6px;border:1px solid #000;">#</th>
          <th style="padding:6px;border:1px solid #000;">Chapitre</th>
          <th style="padding:6px;border:1px solid #000;">Statut</th>
          <th style="padding:6px;border:1px solid #000;">Fichiers</th>
          <th style="padding:6px;border:1px solid #000;">Observations</th>
        </tr>
        ${rows}
      </table>
    `;
  }).join("");

  const html = buildDocHtml(`DOE RCU TER ${rue.secteur} — Tronçon ${rue.code} — ${rue.nom}`, `Secteur ${rue.secteur}`, st.pct, sections);
  telechargerDoc(`DOE_${rue.code}_${rue.nom.replace(/[^\w]+/g, '_')}.doc`, html);
}

function buildDocHtml(titre, soustitre, pct, sections) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titre}</title></head><body>
<div style="font-family:Calibri;">
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  <tr>
    <td style="border:1px solid #000;padding:8px;width:30%;"><strong>FCTP (mandataire) + NETPC + ENGIE/Isoplus</strong></td>
    <td style="border:1px solid #000;padding:8px;">MOA : ${DATA.meta.moa}<br>MOE : ${DATA.meta.moe}<br>Projet : ${DATA.meta.project}<br>Référence sommaire : ${DATA.meta.reference_sommaire || ''}</td>
  </tr>
</table>
<h1 style="color:#0b3b8c;text-align:center;">DOSSIER DES OUVRAGES EXÉCUTÉS</h1>
<h2 style="text-align:center;">${titre}</h2>
<p style="text-align:center;">${soustitre} · Avancement : <strong>${pct} %</strong></p>
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
    <td style="padding:6px;border:1px solid #000;">${titre}</td>
  </tr>
</table>

${sections}

<p style="margin-top:24px;font-size:11px;color:#666;">Généré le ${new Date().toLocaleString('fr-FR')} · DOE_MATABIAU_App v4</p>
</div></body></html>`;
}

function telechargerDoc(nom, html) {
  const blob = new Blob([html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nom;
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
