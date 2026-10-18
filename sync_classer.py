r"""
Sync DOE MATABIAU v3 : git pull + classement automatique vers Qualité_MATABIAU/.

1. git pull dans le repo DOE_MATABIAU_App
2. Lit data.json pour obtenir les mappings dynamiques rues / lots / chapitres
3. Parcourt storage/<rue_code>/<lot_id>/<chap_id>/* et copie chaque fichier vers
   Qualité_MATABIAU\<rue_dossier>\<lot_dossier>\<chap_dossier>\<fichier_nettoyé>
4. Nettoie les timestamps en préfixe (ex: 1734567890_PV.pdf -> PV.pdf)
5. Gère les collisions avec suffixe _v2, _v3, ...
6. Logue tout dans %LOCALAPPDATA%\DOE_MATABIAU\sync.log
"""
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime

REPO_DIR = r"C:\Users\bonho\OneDrive\Bureau\DOE_MATABIAU_App"
STORAGE = os.path.join(REPO_DIR, "storage")
DATA_JSON = os.path.join(REPO_DIR, "data.json")
TARGET_BASE = r"C:\Users\bonho\OneDrive\Bureau\Qualité_MATABIAU"
LOG_DIR = os.path.join(os.environ.get("LOCALAPPDATA", r"C:\Users\bonho\AppData\Local"), "DOE_MATABIAU")
LOG_FILE = os.path.join(LOG_DIR, "sync.log")

TIMESTAMP_RE = re.compile(r"^\d{10,13}_(.+)$")


def log(msg, verbose=True):
    os.makedirs(LOG_DIR, exist_ok=True)
    ligne = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(ligne + "\n")
    if verbose:
        try:
            print(ligne)
        except UnicodeEncodeError:
            print(ligne.encode("ascii", "replace").decode())


def git_pull():
    log("--- Démarrage synchro v3 ---")
    if not os.path.isdir(os.path.join(REPO_DIR, ".git")):
        log("[ERREUR] Pas un dépôt Git : " + REPO_DIR)
        return False
    try:
        r = subprocess.run(
            ["git", "pull", "--rebase", "origin", "main"],
            cwd=REPO_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        if r.returncode == 0:
            log("git pull OK")
            if r.stdout.strip():
                log("  " + r.stdout.strip().replace("\n", " | "))
            return True
        log(f"[ERREUR] git pull a échoué (code {r.returncode})")
        if r.stderr:
            log("  " + r.stderr.strip().replace("\n", " | "))
        return False
    except subprocess.TimeoutExpired:
        log("[ERREUR] git pull timeout (120s)")
        return False
    except FileNotFoundError:
        log("[ERREUR] git introuvable dans le PATH")
        return False


def charger_mappings():
    """Lit data.json et construit les mappings code→dossier."""
    with open(DATA_JSON, encoding="utf-8") as f:
        d = json.load(f)
    rue_map = {r["code"]: r["dossier"] for r in d["rues"]}
    lots_map = {}
    for lot in d["lots"]:
        lots_map[lot["id"]] = {
            "dossier": lot["dossier"],
            "chapitres": {c["id"]: c["dossier"] for c in lot["chapitres"]},
        }
    return rue_map, lots_map


def nettoyer_nom(nom):
    m = TIMESTAMP_RE.match(nom)
    return m.group(1) if m else nom


def chemin_cible_unique(dossier, nom):
    cible = os.path.join(dossier, nom)
    if not os.path.exists(cible):
        return cible
    base, ext = os.path.splitext(nom)
    i = 2
    while True:
        candidat = os.path.join(dossier, f"{base}_v{i}{ext}")
        if not os.path.exists(candidat):
            return candidat
        i += 1


def classer():
    if not os.path.isdir(STORAGE):
        log("Pas de dossier storage/ (aucun fichier déposé)")
        return 0, 0

    rue_map, lots_map = charger_mappings()
    copies = 0
    ignores = 0

    for rue_code in sorted(os.listdir(STORAGE)):
        rue_dir = os.path.join(STORAGE, rue_code)
        if not os.path.isdir(rue_dir):
            continue
        if rue_code not in rue_map:
            log(f"[WARN] Code rue inconnu : {rue_code}")
            continue
        rue_dossier = rue_map[rue_code]

        for lot_id in sorted(os.listdir(rue_dir)):
            lot_dir = os.path.join(rue_dir, lot_id)
            if not os.path.isdir(lot_dir):
                continue
            if lot_id not in lots_map:
                log(f"[WARN] Lot inconnu : {lot_id} (rue {rue_code})")
                continue
            lot_dossier = lots_map[lot_id]["dossier"]
            chap_map = lots_map[lot_id]["chapitres"]

            for chap_id in sorted(os.listdir(lot_dir)):
                chap_dir = os.path.join(lot_dir, chap_id)
                if not os.path.isdir(chap_dir):
                    continue
                if chap_id not in chap_map:
                    log(f"[WARN] Chapitre inconnu : {chap_id} (lot {lot_id} rue {rue_code})")
                    continue
                chap_dossier = chap_map[chap_id]
                dossier_cible = os.path.join(TARGET_BASE, rue_dossier, lot_dossier, chap_dossier)
                os.makedirs(dossier_cible, exist_ok=True)

                for fichier in sorted(os.listdir(chap_dir)):
                    src = os.path.join(chap_dir, fichier)
                    if not os.path.isfile(src):
                        continue
                    nom_propre = nettoyer_nom(fichier)
                    cible_direct = os.path.join(dossier_cible, nom_propre)
                    if os.path.isfile(cible_direct) and os.path.getsize(cible_direct) == os.path.getsize(src):
                        ignores += 1
                        continue
                    cible = chemin_cible_unique(dossier_cible, nom_propre)
                    shutil.copy2(src, cible)
                    copies += 1
                    log(f"  + {rue_code}/{lot_id}/{chap_id}/{fichier} -> {rue_dossier}\\{lot_dossier}\\{chap_dossier}\\{os.path.basename(cible)}")
    return copies, ignores


def main():
    if not git_pull():
        log("Arrêt : git pull échoué")
        return 1
    copies, ignores = classer()
    log(f"Classement terminé : {copies} nouveau(x), {ignores} déjà présent(s)")
    log("--- Fin synchro ---\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
