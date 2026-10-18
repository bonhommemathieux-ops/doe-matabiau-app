// DOE MATABIAU App v3 — Refonte selon STG TER §7 : 3 lots × 32 chap × 21 rues
// Stack: GitHub + JSON (data.json versionné via API) + fichiers dans storage/<rue>/<lot_id>/<chap_id>/

const STATUTS = {
  "": { label: "Non démarré", classe: "", couleur: "#607d8b" },
  "X": { label: "Fourni", classe: "X", couleur: "#2e7d32" },
  "P": { label: "Partiel", classe: "P", couleur: "#ef6c00" },
  "R": { label: "Bloqué", classe: "R", couleur: "#c62828" },
  "NA": { label: "N/A", classe: "NA", couleur: "#1565c0" }
};

// Rôles : admin voit/modifie tout, fctp modifie LOT_01, netpc modifie LOT_03, viewer lecture seule
const ROLES = {
  "admin": { label: "Admin · Mathieu", couleur: "#0b3b8c", peutEcrire: true, lots: ["LOT_01", "LOT_02", "LOT_03"] },
  "fctp": { label: "FCTP (VRD)", couleur: "#f28c28", peutEcrire: true, lots: ["LOT_01"] },
  "netpc": { label: "NETPC (Pose/Soudage)", couleur: "#1565c0", peutEcrire: true, lots: ["LOT_03"] },
  "viewer": { label: "Visibilité", couleur: "#607d8b", peutEcrire: false, lots: [] }
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

// --- Helpers rôle / lot ---
function peutEcrire() { return ROLES[ROLE].peutEcrire && TOKEN_GH; }
function peutModifierLot(lotId) {
  const r = ROLES[ROLE];
  return r.peutEcrire && r.lots.includes(lotId);
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

// --- Accès état hiérarchique ---
function getEtat(code, lotId, chapId) {
  return DATA.etats?.[code]?.[lotId]?.[chapId] || {};
}
function setEtat(code, lotId, chapId, patch) {
  if (!DATA.etats) DATA.etats = {};
  if (!DATA.etats[code]) DATA.etats[code] = {};
  if (!DATA.etats[code][lotId]) DATA.etats[code][lotId] = {};
  if (!DATA.etats[code][lotId][chapId]) DATA.etats[code][lotId][chapId] = {};
  Object.assign(DATA.etats[code][lotId][chapId], patch);
}

// --- Calculs d'avancement ---
function iterChapitres(callback) {
  for (const lot of DATA.lots) {
    for (const chap of lot.chapitres) {
      callback(lot, chap);
    }
  }
}

function statutRue(code) {
  let x = 0, p = 0, na = 0, r = 0, total = 0, nbFichiers = 0;
  iterChapitres((lot, chap) => {
    const e = getEtat(code, lot.id, chap.id);
    const s = e.statut || "";
    if (s === "X") x++;
    else if (s === "P") p++;
    else if (s === "NA") na++;
    else if (s === "R") r++;
    total++;
    nbFichiers += e.fichiers?.length || 0;
  });
  const compte = total - na;
  const pct = compte === 0 ? 100 : Math.round(((x + p * 0.5) / compte) * 100);
  let classe = "";
  if (r > 0) classe = "statut-rouge";
  else if (pct === 100) classe = "statut-vert";
  else if (pct > 0) classe = "statut-orange";
  return { x, p, na, r, total, compte, pct, classe, nbFichiers };
}

function statutLot(code, lotId) {
  const lot = DATA.lots.find(l => l.id === lotId);
  if (!lot) return { pct: 0, x: 0, total: 0 };
  let x = 0, p = 0, na = 0, r = 0, total = 0;
  for (const chap of lot.chapitres) {
    const e = getEtat(code, lotId, chap.id);
    const s = e.statut || "";
    if (s === "X") x++;
    else if (s === "P") p++;
    else if (s === "NA") na++;
    else if (s === "R") r++;
    total++;
  }
  const compte = total - na;
  const pct = compte === 0 ? 100 : Math.round(((x + p * 0.5) / compte) * 100);
  return { x, p, na, r, total, compte, pct };
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
  document.getElementById("global-pct").textContent = statutGlobal() + " %";
  container.innerHTML = "";
  for (const rue of DATA.rues) {
    const s = statutRue(rue.code);
    const card = document.createElement("div");
    card.className = "rue-card " + s.classe;

    const miniLots = DATA.lots.map(lot => {
      const sl = statutLot(rue.code, lot.id);
      const minis = lot.chapitres.map(c => {
        const st = getEtat(rue.code, lot.id, c.id).statut || "";
        return `<div class="mini-chapitre ${st}" title="${lot.id} · ${c.id} ${c.label}: ${STATUTS[st]?.label || 'vide'}"></div>`;
      }).join("");
      return `<div class="mini-lot-group" title="${lot.label} : ${sl.pct}%" style="border-top:2px solid ${lot.couleur};">${minis}</div>`;
    }).join("");

    card.innerHTML = `
      <div class="code">${rue.code} · ${rue.secteur}</div>
      <div class="nom">${rue.nom}</div>
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span class="pct">${s.pct} %</span>
        <span style="font-size:12px;color:var(--texte-faible);">${s.x}/${s.compte} · 📎 ${s.nbFichiers}</span>
      </div>
      <div class="barre"><div class="barre-fill" style="width:${s.pct}%"></div></div>
      <div class="mini-chapitres" style="display:flex;gap:6px;">${miniLots}</div>
    `;
    card.onclick = () => ouvrirFiche(rue.code);
    container.appendChild(card);
  }
}

// --- Modal fiche rue ---
function ouvrirFiche(code) {
  CURRENT_RUE = code;
  const rue = DATA.rues.find(r => r.code === code);
  const modal = document.getElementById("modal");
  const body = document.getElementById("modal-body");
  const s = statutRue(code);

  const sections = DATA.lots.map(lot => {
    const sl = statutLot(code, lot.id);
    const canEditLot = peutModifierLot(lot.id);
    return `
      <div class="lot-section" style="border-left:4px solid ${lot.couleur};padding-left:12px;margin:16px 0;">
        <h3 style="color:${lot.couleur};margin:0 0 4px 0;">
          ${lot.label} — ${lot.entreprise}
          <span style="font-size:14px;color:#555;font-weight:400;">· ${sl.pct}% (${sl.x}/${sl.compte})</span>
          ${!canEditLot && ROLES[ROLE].peutEcrire ? '<span style="font-size:11px;color:#999;">🔒 lecture seule</span>' : ''}
        </h3>
        <div class="chapitres-list">
          ${lot.chapitres.map(c => renderChapitre(lot, c, getEtat(code, lot.id, c.id))).join("")}
        </div>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <h2>${rue.code} — ${rue.nom}</h2>
    <div class="subtitle">
      Secteur ${rue.secteur} · Avancement global : <strong>${s.pct} %</strong>
      · 📎 ${s.nbFichiers} fichier${s.nbFichiers > 1 ? 's' : ''}
      · Rôle : <span style="color:${ROLES[ROLE].couleur};font-weight:600;">${ROLES[ROLE].label}</span>
    </div>

    ${sections}

    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;position:sticky;bottom:0;background:#fff;padding:12px 0;border-top:1px solid #eee;">
      <button onclick="genererSommaireDocx('${code}')">📄 Générer sommaire .docx</button>
      ${peutEcrire() ? `<button class="success" onclick="pousserGitHub()">💾 Sauvegarder sur GitHub</button>` : ''}
      <button class="secondary modal-close" onclick="fermerModal()">Fermer</button>
    </div>
  `;
  modal.classList.add("open");
}

function renderChapitre(lot, chap, e) {
  const canEdit = peutModifierLot(lot.id);
  const st = e.statut || "";
  const fichiers = e.fichiers || [];
  return `
    <div class="chapitre-item ${canEdit ? '' : 'locked'}">
      <div class="chapitre-head">
        <div>
          <strong>${chap.id}. ${chap.label}</strong>
          ${chap.critical ? '<span class="dot-critique" title="Critique">●</span>' : ''}
        </div>
        <div class="statut-cell">
          ${canEdit ? `
            <button class="btn-statut ${st === 'X' ? 'active-X' : ''}" onclick="setStatut('${lot.id}','${chap.id}','X')">✓ Fourni</button>
            <button class="btn-statut ${st === 'P' ? 'active-P' : ''}" onclick="setStatut('${lot.id}','${chap.id}','P')">~ Partiel</button>
            <button class="btn-statut ${st === 'R' ? 'active-R' : ''}" onclick="setStatut('${lot.id}','${chap.id}','R')">⚠ Bloqué</button>
            <button class="btn-statut ${st === 'NA' ? 'active-NA' : ''}" onclick="setStatut('${lot.id}','${chap.id}','NA')">N/A</button>
            <button class="btn-statut" onclick="setStatut('${lot.id}','${chap.id}','')">×</button>
          ` : `<span style="color:${STATUTS[st]?.couleur || '#607d8b'};font-weight:600;">${STATUTS[st]?.label || '—'}</span>`}
        </div>
      </div>
      ${canEdit ? `
        <textarea class="commentaire" onblur="setCommentaire('${lot.id}','${chap.id}',this.value)" placeholder="Observations…">${e.commentaire || ''}</textarea>
      ` : (e.commentaire ? `<div class="commentaire-ro">${e.commentaire}</div>` : '')}

      <div class="fichiers-zone">
        <div class="fichiers-list">
          ${fichiers.map((f, i) => `
            <div class="fichier">
              <a href="https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${f.path}" target="_blank">
                ${getIconeFichier(f.name)} ${f.name}
              </a>
              <span class="fichier-meta">${(f.taille / 1024).toFixed(0)} ko · ${f.date} · ${f.auteur}</span>
              ${canEdit ? `<button class="danger btn-mini" onclick="supprimerFichier('${lot.id}','${chap.id}',${i})">🗑</button>` : ''}
            </div>
          `).join('')}
        </div>
        ${canEdit ? `
          <label class="upload-zone" ondrop="dropFichier(event,'${lot.id}','${chap.id}')" ondragover="event.preventDefault()">
            <input type="file" style="display:none;" multiple onchange="uploadFichiers('${lot.id}','${chap.id}',this.files)">
            <span>📎 Déposer un fichier (ou glisser-déposer)</span>
          </label>
        ` : (ROLES[ROLE].peutEcrire ? `<div class="locked-msg">⛔ Non autorisé pour ${ROLES[ROLE].label} (lot ${lot.id})</div>` : '')}
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
  if (document.getElementById("grid")) rendreDashboard(document.getElementById("grid"));
}

function setStatut(lotId, chapId, statut) {
  setEtat(CURRENT_RUE, lotId, chapId, {
    statut,
    date: new Date().toISOString().slice(0, 10),
    auteur: ROLES[ROLE].label
  });
  ouvrirFiche(CURRENT_RUE);
}

function setCommentaire(lotId, chapId, texte) {
  setEtat(CURRENT_RUE, lotId, chapId, {
    commentaire: texte,
    date: new Date().toISOString().slice(0, 10),
    auteur: ROLES[ROLE].label
  });
}

// --- Upload fichiers via GitHub Contents API ---
async function uploadFichiers(lotId, chapId, files) {
  if (!TOKEN_GH) { toast("Token requis pour upload", true); return; }
  for (const f of files) {
    await uploadUnFichier(lotId, chapId, f);
  }
  ouvrirFiche(CURRENT_RUE);
}

function dropFichier(evt, lotId, chapId) {
  evt.preventDefault();
  uploadFichiers(lotId, chapId, evt.dataTransfer.files);
}

async function uploadUnFichier(lotId, chapId, file) {
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
      const path = `storage/${CURRENT_RUE}/${lotId}/${chapId}/${timestamp}_${safeName}`;
      const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
      try {
        const r = await fetch(url, {
          method: "PUT",
          headers: { Authorization: `token ${TOKEN_GH}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Upload ${file.name} dans ${CURRENT_RUE}/${lotId}/${chapId} (${ROLES[ROLE].label})`,
            content: b64,
            branch: GITHUB_CONFIG.branch
          })
        });
        if (r.ok) {
          const e = getEtat(CURRENT_RUE, lotId, chapId);
          const fichiers = e.fichiers || [];
          fichiers.push({
            name: file.name,
            path: path,
            taille: file.size,
            date: new Date().toISOString().slice(0, 10),
            auteur: ROLES[ROLE].label
          });
          setEtat(CURRENT_RUE, lotId, chapId, {
            fichiers,
            date: new Date().toISOString().slice(0, 10),
            auteur: ROLES[ROLE].label
          });
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

async function supprimerFichier(lotId, chapId, index) {
  if (!confirm("Supprimer ce fichier ?")) return;
  const e = getEtat(CURRENT_RUE, lotId, chapId);
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
      ouvrirFiche(CURRENT_RUE);
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

// --- Export Excel (SheetJS) ---
function genererExcel() {
  const wb = XLSX.utils.book_new();

  // Onglet Dashboard : une ligne par rue, colonnes par chapitre (plats avec préfixe LOT)
  const colsChap = [];
  iterChapitres((lot, chap) => colsChap.push({ lotId: lot.id, chapId: chap.id, label: `${lot.id}·${chap.id} ${chap.label}` }));
  const headerDash = ["Code", "Rue", "Secteur", ...colsChap.map(c => c.label), "Fichiers", "%", "Statut"];
  const rowsDash = [headerDash];
  for (const rue of DATA.rues) {
    const s = statutRue(rue.code);
    const chapStats = colsChap.map(c => getEtat(rue.code, c.lotId, c.chapId).statut || "");
    let st = "⚪ Non démarré";
    if (s.r > 0) st = "🔴 Bloqué";
    else if (s.pct === 100) st = "🟢 Complet";
    else if (s.pct > 0) st = "🟠 En cours";
    rowsDash.push([rue.code, rue.nom, rue.secteur, ...chapStats, s.nbFichiers, s.pct + "%", st]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsDash), "Dashboard");

  // Onglet Suivi détaillé : une ligne par rue × lot × chap
  const headerSuivi = ["Code rue", "Rue", "Lot", "Entreprise", "Chapitre", "Statut", "Date", "Auteur", "Fichiers", "Commentaire"];
  const rowsSuivi = [headerSuivi];
  for (const rue of DATA.rues) {
    for (const lot of DATA.lots) {
      for (const chap of lot.chapitres) {
        const e = getEtat(rue.code, lot.id, chap.id);
        const stLabel = STATUTS[e.statut || ""]?.label || "Non démarré";
        const fichiers = (e.fichiers || []).map(f => f.name).join(" | ");
        rowsSuivi.push([rue.code, rue.nom, lot.id, lot.entreprise, `${chap.id}. ${chap.label}`, stLabel, e.date || "", e.auteur || "", fichiers, e.commentaire || ""]);
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsSuivi), "Suivi détaillé");

  // Onglet Récap par lot/chap
  const headerRecap = ["Lot", "Entreprise", "Chapitre", "Fournis (X)", "Partiels (~)", "Bloqués", "N/A", "Non démarrés", "Fichiers"];
  const rowsRecap = [headerRecap];
  for (const lot of DATA.lots) {
    for (const chap of lot.chapitres) {
      let x = 0, p = 0, r = 0, na = 0, vide = 0, nbF = 0;
      for (const rue of DATA.rues) {
        const e = getEtat(rue.code, lot.id, chap.id);
        const s = e.statut || "";
        if (s === "X") x++;
        else if (s === "P") p++;
        else if (s === "R") r++;
        else if (s === "NA") na++;
        else vide++;
        nbF += (e.fichiers?.length || 0);
      }
      rowsRecap.push([lot.id, lot.entreprise, `${chap.id}. ${chap.label}`, x, p, r, na, vide, nbF]);
    }
  }
  rowsRecap.push([]);
  rowsRecap.push(["Global", "", "", "", "", "", "", "", statutGlobal() + "%"]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsRecap), "Récap");

  const nom = `Suivi_DOE_MATABIAU_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, nom);
  toast("Excel généré: " + nom);
}

// --- Génération sommaire .docx (HTML enregistré en .doc) ---
function genererSommaireDocx(code) {
  const rue = DATA.rues.find(r => r.code === code);
  const s = statutRue(code);

  const sections = DATA.lots.map(lot => {
    const sl = statutLot(code, lot.id);
    const rows = lot.chapitres.map(c => {
      const e = getEtat(code, lot.id, c.id);
      const st = STATUTS[e.statut || ""]?.label || "—";
      const fichiers = (e.fichiers || []).map(f => f.name).join("<br>") || "—";
      return `<tr>
        <td style="padding:6px;border:1px solid #000;">${c.id}</td>
        <td style="padding:6px;border:1px solid #000;">${c.label}</td>
        <td style="padding:6px;border:1px solid #000;">${st}</td>
        <td style="padding:6px;border:1px solid #000;font-size:10px;">${fichiers}</td>
        <td style="padding:6px;border:1px solid #000;">${e.commentaire || ''}</td>
      </tr>`;
    }).join("");
    return `
      <h3 style="color:${lot.couleur};margin-top:24px;">${lot.label} — ${lot.entreprise} (${sl.pct}%)</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:${lot.couleur};color:#fff;">
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

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>DOE ${rue.nom}</title></head><body>
<div style="font-family:Calibri;">
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  <tr>
    <td style="border:1px solid #000;padding:8px;width:30%;"><strong>FCTP (mandataire) + NETPC + ENGIE/Isoplus</strong></td>
    <td style="border:1px solid #000;padding:8px;">MOA : ${DATA.meta.moa}<br>MOE : ${DATA.meta.moe}<br>Projet : ${DATA.meta.project}<br>Référence sommaire : ${DATA.meta.reference_sommaire || ''}</td>
  </tr>
</table>
<h1 style="color:#0b3b8c;text-align:center;">DOSSIER DES OUVRAGES EXÉCUTÉS</h1>
<h2 style="text-align:center;">${rue.code} — ${rue.nom}</h2>
<p style="text-align:center;">Secteur ${rue.secteur} · Avancement global : <strong>${s.pct} %</strong></p>
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
    <td style="padding:6px;border:1px solid #000;">DOE par rue conforme STG TER §7</td>
  </tr>
</table>

${sections}

<p style="margin-top:24px;font-size:11px;color:#666;">Généré le ${new Date().toLocaleString('fr-FR')} · DOE_MATABIAU_App v3</p>
</div></body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DOE_${rue.code}_${rue.nom.replace(/[^\w]+/g, '_')}.doc`;
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
