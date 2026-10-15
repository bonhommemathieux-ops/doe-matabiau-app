"""Génère Suivi_DOE_Partiel_MATABIAU.xlsx — template initial (3 onglets)."""
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

RUES = [
    ("S2-01", "Rue Montserby", "S2"),
    ("S2-02", "Rue de Périole", "S2"),
    ("S2-03", "Rue Jean Aicard", "S2"),
    ("S2-04", "Avenue Léon Jouhaux", "S2"),
    ("S2-05", "Rue Léon Jouhaux", "S2"),
    ("S2-06", "Rue St Louis - Noémie Dessale - Jolimont", "S2"),
    ("S2-07", "Rue de Jolimont", "S2"),
    ("S2-08", "Avenue Léon Blum", "S2"),
    ("S3-01", "Avenue de Lyon", "S3"),
    ("S3-02", "Avenue de Lyon - Rue Chabanon", "S3"),
    ("S3-03", "Rue du Maroc", "S3"),
    ("S3-04", "Avenue de Lavaur - Chemin de Michoun", "S3"),
    ("S3-05", "Rue du Faubourg Bonnefoy", "S3"),
    ("S3-06", "Avenue de Lyon - Pont Matabiau - Bd Bonrepos", "S3"),
    ("S3-07", "Impasse Guisot - Turlan", "S3"),
    ("S3-08", "Rue de Turin", "S3"),
    ("S3-09", "Chemin de Lapujade", "S3"),
    ("S3-10", "Chemin de Lapujade - Rue Michel Ange", "S3"),
    ("S3-11", "Allée Monsonego Sandler", "S3"),
    ("S3-12", "Rue du Maroc - Zone SERNAM", "S3"),
]

CHAPITRES = [
    ("01", "Plans de récolement"),
    ("02", "Matériels posés"),
    ("03", "Essais & contrôles"),
    ("04", "FCQ & auto-contrôles"),
    ("05", "PV de réception"),
    ("06", "Sécurité (PPSPS/diag/AIPR)"),
    ("07", "Voiries & revêtement"),
    ("08", "Photos de chantier"),
    ("09", "Non-conformités & réserves"),
    ("10", "Correspondance MOE/MOA"),
]

# Couleurs charte FCTP (validée BETEG)
BLEU_FCTP = "0B3B8C"
ORANGE_FCTP = "F28C28"
VERT = "C6EFCE"
ORANGE = "FFE699"
ROUGE = "F8CBAD"
BLEU_NA = "D9E1F2"
GRIS = "D9D9D9"

thin = Side(border_style="thin", color="BFBFBF")
border = Border(left=thin, right=thin, top=thin, bottom=thin)

wb = Workbook()

# =============== ONGLET 1 : DASHBOARD ===============
ws1 = wb.active
ws1.title = "Dashboard"

# Titre
ws1["A1"] = "SUIVI DOE PARTIEL — RCU TOULOUSE MATABIAU"
ws1["A1"].font = Font(size=16, bold=True, color="FFFFFF")
ws1["A1"].fill = PatternFill("solid", fgColor=BLEU_FCTP)
ws1["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws1.merge_cells(start_row=1, start_column=1, end_row=1, end_column=15)
ws1.row_dimensions[1].height = 28

# Sous-titre MOA/MOE
ws1["A2"] = "MOA : TER (Toulouse Energies Renouvelables)   ·   MOE : GTA ENERGIES   ·   Entreprise : FCTP"
ws1["A2"].font = Font(italic=True, color="FFFFFF")
ws1["A2"].fill = PatternFill("solid", fgColor=ORANGE_FCTP)
ws1["A2"].alignment = Alignment(horizontal="center")
ws1.merge_cells(start_row=2, start_column=1, end_row=2, end_column=15)

# Entête tableau
headers = ["Code", "Rue", "Sect."] + [f"{c[0]}" for c in CHAPITRES] + ["%", "Statut"]
for col, h in enumerate(headers, 1):
    c = ws1.cell(row=4, column=col, value=h)
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor=BLEU_FCTP)
    c.alignment = Alignment(horizontal="center", vertical="center")
    c.border = border

# Ligne de rappel des chapitres (ligne 5)
for col, chap in enumerate(CHAPITRES, 4):
    c = ws1.cell(row=5, column=col, value=chap[1])
    c.font = Font(size=8, italic=True, color="595959")
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = border
ws1.cell(row=5, column=1).border = border
ws1.cell(row=5, column=2).border = border
ws1.cell(row=5, column=3).border = border
ws1.cell(row=5, column=14).border = border
ws1.cell(row=5, column=15).border = border
ws1.row_dimensions[5].height = 50

# Lignes de rues
start_row = 6
for i, (code, nom, sec) in enumerate(RUES):
    r = start_row + i
    ws1.cell(row=r, column=1, value=code).font = Font(bold=True)
    ws1.cell(row=r, column=2, value=nom)
    ws1.cell(row=r, column=3, value=sec).alignment = Alignment(horizontal="center")
    for ci, _ in enumerate(CHAPITRES):
        cell = ws1.cell(row=r, column=4 + ci, value="")
        cell.alignment = Alignment(horizontal="center")
    # % — formule qui compte X=1, P=0.5, exclut N/A
    chap_range = f"{get_column_letter(4)}{r}:{get_column_letter(3+len(CHAPITRES))}{r}"
    formule_pct = (
        f'=IFERROR(ROUND((COUNTIF({chap_range},"X")+COUNTIF({chap_range},"P")*0.5)/'
        f'(COUNTA({chap_range})-COUNTIF({chap_range},"N/A")+COUNTIF({chap_range},""))*100,0),0)'
    )
    pct_cell = ws1.cell(row=r, column=4 + len(CHAPITRES), value=formule_pct)
    pct_cell.number_format = '0"%"'
    pct_cell.alignment = Alignment(horizontal="center")
    pct_cell.font = Font(bold=True)
    # Statut (via formule)
    stat_cell = ws1.cell(row=r, column=5 + len(CHAPITRES),
                         value=f'=IF(COUNTIF({chap_range},"R")>0,"🔴 Bloqué",'
                               f'IF({pct_cell.coordinate}=100,"🟢 Complet",'
                               f'IF({pct_cell.coordinate}>0,"🟠 En cours","⚪ Non démarré")))')
    stat_cell.alignment = Alignment(horizontal="center")
    for col in range(1, 16):
        ws1.cell(row=r, column=col).border = border

# Ligne total
total_row = start_row + len(RUES) + 1
ws1.cell(row=total_row, column=1, value="GLOBAL").font = Font(bold=True, color="FFFFFF")
ws1.cell(row=total_row, column=1).fill = PatternFill("solid", fgColor=BLEU_FCTP)
pct_range = f"{get_column_letter(14)}{start_row}:{get_column_letter(14)}{start_row+len(RUES)-1}"
ws1.cell(row=total_row, column=14, value=f"=ROUND(AVERAGE({pct_range}),0)").number_format = '0"%"'
ws1.cell(row=total_row, column=14).font = Font(bold=True, color="FFFFFF")
ws1.cell(row=total_row, column=14).fill = PatternFill("solid", fgColor=BLEU_FCTP)
ws1.cell(row=total_row, column=14).alignment = Alignment(horizontal="center")
for col in range(2, 14):
    ws1.cell(row=total_row, column=col).fill = PatternFill("solid", fgColor=BLEU_FCTP)
for col in range(1, 16):
    ws1.cell(row=total_row, column=col).border = border

# Largeurs
ws1.column_dimensions["A"].width = 8
ws1.column_dimensions["B"].width = 42
ws1.column_dimensions["C"].width = 6
for ci in range(len(CHAPITRES)):
    ws1.column_dimensions[get_column_letter(4+ci)].width = 6
ws1.column_dimensions[get_column_letter(4+len(CHAPITRES))].width = 8
ws1.column_dimensions[get_column_letter(5+len(CHAPITRES))].width = 16

# Mise en forme conditionnelle manuelle via les cellules (sera renforcée côté app)
from openpyxl.formatting.rule import CellIsRule
rng = f"{get_column_letter(4)}{start_row}:{get_column_letter(3+len(CHAPITRES))}{start_row+len(RUES)-1}"
ws1.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"X"'], fill=PatternFill("solid", fgColor=VERT)))
ws1.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"P"'], fill=PatternFill("solid", fgColor=ORANGE)))
ws1.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"R"'], fill=PatternFill("solid", fgColor=ROUGE)))
ws1.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"N/A"'], fill=PatternFill("solid", fgColor=BLEU_NA)))

ws1.freeze_panes = "D6"

# Légende
leg_row = total_row + 3
ws1.cell(row=leg_row, column=1, value="Légende :").font = Font(bold=True)
legendes = [("X", "Fourni", VERT), ("P", "Partiel", ORANGE), ("R", "Bloqué", ROUGE), ("N/A", "Sans objet", BLEU_NA)]
for i, (code, lbl, color) in enumerate(legendes):
    c = ws1.cell(row=leg_row, column=2+i*2, value=code)
    c.fill = PatternFill("solid", fgColor=color)
    c.alignment = Alignment(horizontal="center")
    c.border = border
    ws1.cell(row=leg_row, column=3+i*2, value=lbl).font = Font(italic=True)

# =============== ONGLET 2 : SUIVI DÉTAILLÉ ===============
ws2 = wb.create_sheet("Suivi détaillé")
ws2["A1"] = "SUIVI DÉTAILLÉ — DOE PARTIEL MATABIAU"
ws2["A1"].font = Font(size=14, bold=True, color="FFFFFF")
ws2["A1"].fill = PatternFill("solid", fgColor=BLEU_FCTP)
ws2.merge_cells("A1:F1")
ws2["A1"].alignment = Alignment(horizontal="center")

headers2 = ["Code rue", "Rue", "Chapitre", "Statut", "Date MàJ", "Commentaire / observation"]
for col, h in enumerate(headers2, 1):
    c = ws2.cell(row=3, column=col, value=h)
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor=BLEU_FCTP)
    c.alignment = Alignment(horizontal="center")
    c.border = border

r = 4
for code, nom, sec in RUES:
    for chap_id, chap_lbl in CHAPITRES:
        ws2.cell(row=r, column=1, value=code).font = Font(bold=True)
        ws2.cell(row=r, column=2, value=nom)
        ws2.cell(row=r, column=3, value=f"{chap_id}. {chap_lbl}")
        for col in range(1, 7):
            ws2.cell(row=r, column=col).border = border
            ws2.cell(row=r, column=col).alignment = Alignment(vertical="top", wrap_text=True)
        r += 1

ws2.column_dimensions["A"].width = 10
ws2.column_dimensions["B"].width = 42
ws2.column_dimensions["C"].width = 32
ws2.column_dimensions["D"].width = 14
ws2.column_dimensions["E"].width = 12
ws2.column_dimensions["F"].width = 50
ws2.freeze_panes = "A4"

# =============== ONGLET 3 : RÉCAP ===============
ws3 = wb.create_sheet("Récap")
ws3["A1"] = "RÉCAP PAR CHAPITRE"
ws3["A1"].font = Font(size=14, bold=True, color="FFFFFF")
ws3["A1"].fill = PatternFill("solid", fgColor=BLEU_FCTP)
ws3.merge_cells("A1:G1")
ws3["A1"].alignment = Alignment(horizontal="center")

headers3 = ["Chapitre", "Fournis (X)", "Partiels (P)", "Bloqués (R)", "N/A", "Non démarrés", "% chapitre"]
for col, h in enumerate(headers3, 1):
    c = ws3.cell(row=3, column=col, value=h)
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor=BLEU_FCTP)
    c.alignment = Alignment(horizontal="center")
    c.border = border

for i, (chap_id, chap_lbl) in enumerate(CHAPITRES):
    r = 4 + i
    col_lettre = get_column_letter(4 + i)
    plage = f"Dashboard!{col_lettre}{start_row}:{col_lettre}{start_row+len(RUES)-1}"
    ws3.cell(row=r, column=1, value=f"{chap_id}. {chap_lbl}").font = Font(bold=True)
    ws3.cell(row=r, column=2, value=f'=COUNTIF({plage},"X")').alignment = Alignment(horizontal="center")
    ws3.cell(row=r, column=3, value=f'=COUNTIF({plage},"P")').alignment = Alignment(horizontal="center")
    ws3.cell(row=r, column=4, value=f'=COUNTIF({plage},"R")').alignment = Alignment(horizontal="center")
    ws3.cell(row=r, column=5, value=f'=COUNTIF({plage},"N/A")').alignment = Alignment(horizontal="center")
    ws3.cell(row=r, column=6, value=f'={len(RUES)}-COUNTA({plage})+COUNTIF({plage},"")').alignment = Alignment(horizontal="center")
    ws3.cell(row=r, column=7, value=f'=IFERROR(ROUND((B{r}+C{r}*0.5)/({len(RUES)}-E{r})*100,0),0)').number_format = '0"%"'
    ws3.cell(row=r, column=7).alignment = Alignment(horizontal="center")
    ws3.cell(row=r, column=7).font = Font(bold=True)
    for col in range(1, 8):
        ws3.cell(row=r, column=col).border = border

# Ligne globale
r_total = 4 + len(CHAPITRES) + 1
ws3.cell(row=r_total, column=1, value="GLOBAL").font = Font(bold=True, color="FFFFFF")
ws3.cell(row=r_total, column=7, value=f'=ROUND(AVERAGE(G4:G{3+len(CHAPITRES)}),0)').number_format = '0"%"'
ws3.cell(row=r_total, column=7).font = Font(bold=True, color="FFFFFF")
for col in range(1, 8):
    ws3.cell(row=r_total, column=col).fill = PatternFill("solid", fgColor=BLEU_FCTP)
    ws3.cell(row=r_total, column=col).border = border
    ws3.cell(row=r_total, column=col).alignment = Alignment(horizontal="center")

ws3.column_dimensions["A"].width = 36
for col in "BCDEFG":
    ws3.column_dimensions[col].width = 14

# Save
out = "C:/Users/bonho/OneDrive/Bureau/DOE_MATABIAU_App/exports/Suivi_DOE_Partiel_MATABIAU.xlsx"
wb.save(out)
print(f"OK : {out}")
