"""
mask_screenshots.py
Redacts real financial figures and client names from Lumière Ledger marketing screenshots.
Run: python3 mask_screenshots.py
Requires: pip3 install Pillow --break-system-packages
"""

from PIL import Image, ImageDraw, ImageFont
import os

BASE = "/Users/dewey/Downloads/TTLM Website V2/marketing/lumiere-ledger"

# ── Generate synthetic screenshots (no real data) ─────────────────────────────
from PIL import Image, ImageDraw, ImageFont

BG=    "#0f172a"; CARD=  "#1e293b"; CARD2= "#162032"; BORDER="#1e3a5f"
BLUE=  "#60a5fa"; GREEN= "#10b981"; ORANGE="#f97316"; MUTED= "#64748b"
WHITE= "#ffffff"; DIM=   "#94a3b8"

def _fnt(bold=False, size=13):
    path = "/System/Library/Fonts/Helvetica.ttc"
    try: return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

def rct(d, x0, y0, x1, y1, fill, outline=None, radius=6):
    d.rounded_rectangle([x0,y0,x1,y1], radius=radius, fill=fill)
    if outline: d.rounded_rectangle([x0,y0,x1,y1], radius=radius, outline=outline, width=1)

def txt(d, x, y, s, color=WHITE, size=13, bold=True, anchor="la"):
    d.text((x,y), s, fill=color, font=_fnt(bold, size), anchor=anchor)

# ── Synthetic Dashboard ────────────────────────────────────────────────────────
W,H = 1200,760
img = Image.new("RGB",(W,H),BG); d = ImageDraw.Draw(img)
txt(d,40,28,"Operational Intelligence",WHITE,22)
txt(d,40,58,"Recurring Vendors & Subscription Leakage",MUTED,13,False)
for x0,y0,x1,y1,label,val,col,sub in [
    (40, 95,275,185,"ACTIVE SUBSCRIPTIONS","12",   WHITE, ""),
    (285,95,590,185,"APPROX MONTHLY EXPENSE","$1,240/mo",BLUE,""),
    (605,95,895,185,"COMMITTED ANNUAL","$14,880/yr",WHITE,""),
    (910,95,1160,185,"FLAGGED FOR REVIEW","5",    ORANGE,"$890/mo exposure"),
]:
    rct(d,x0,y0,x1,y1,CARD,BORDER)
    txt(d,x0+14,y0+14,label,MUTED,10,False)
    txt(d,x0+14,y0+42,val,col,28)
    if sub: txt(d,x0+14,y0+80,sub,ORANGE,11,False)
rct(d,40,200,1160,230,CARD2)
txt(d,52,210,"TOP SPEND",MUTED,10,False)
txt(d,155,210,"Vendor A  —  $120/mo",BLUE,11,False)
txt(d,370,210,"Vendor B  —  $98/mo",DIM,11,False)
txt(d,565,210,"Vendor C  —  $75/mo",DIM,11,False)
rct(d,40,240,1160,268,CARD2)
for hx,ht in [(55,"VENDOR"),(445,"EST. MONTHLY"),(645,"PROJECTED ANNUAL"),(1060,"FLAGS")]:
    txt(d,hx,250,ht,MUTED,10,False)
vendors=[("Vendor A","$120/mo","$1,440/yr",["SUB","REVIEW"]),
         ("Vendor B","$98/mo", "$1,176/yr",["SUB"]),
         ("Vendor C","$75/mo", "$900/yr",  ["REVIEW"]),
         ("Vendor D","$62/mo", "$744/yr",  []),
         ("Vendor E","$55/mo", "$660/yr",  ["REVIEW"]),
         ("Vendor F","$48/mo", "$576/yr",  ["SUB"]),
         ("Vendor G","$44/mo", "$528/yr",  []),
         ("Vendor H","$29/mo", "$348/yr",  ["SUB","REVIEW"]),
         ("Vendor I","$22/mo", "$264/yr",  []),
         ("Vendor J","$22/mo", "$264/yr",  ["SUB"])]
for i,(vn,mo,yr,flags) in enumerate(vendors):
    ry=270+i*43; fill=CARD if i%2==0 else BG
    d.rectangle([40,ry,1160,ry+41],fill=fill)
    txt(d,55, ry+13,vn,WHITE,13,False)
    txt(d,445,ry+13,mo,WHITE,13,False)
    txt(d,645,ry+13,yr,DIM, 13,False)
    fx=1010
    for flag in flags:
        fc=BLUE if flag=="SUB" else ORANGE
        rct(d,fx,ry+9,fx+54,ry+31,fc+"22",fc,4)
        txt(d,fx+7,ry+13,flag,fc,10,True); fx+=62
img.save(f"{BASE}/screenshot-dashboard.png","PNG")
print("✅ screenshot-dashboard.png")

# ── Synthetic Tax ──────────────────────────────────────────────────────────────
W2,H2=820,580; img2=Image.new("RGB",(W2,H2),BG); d2=ImageDraw.Draw(img2)
txt(d2,30,25,"Schedule C — Tax Summary",WHITE,18)
txt(d2,30,52,"IRS Category Breakdown · Tax Year 2025",MUTED,12,False)
rct(d2,20,75,800,103,CARD2)
for hx,ht in [(32,"CATEGORY"),(342,"TOTAL SPEND"),(452,"DEDUCTIBLE")]:
    txt(d2,hx,84,ht,MUTED,10,False)
tax=[("Advertising & Marketing","$1,200","$1,200"),
     ("Software & Subscriptions","$6,200","$3,100"),
     ("Equipment & Gear",        "$3,800","$3,800"),
     ("Home Office",             "$2,950","$2,950"),
     ("Vehicle & Mileage",       "$1,480","$888"),
     ("Professional Services",   "$1,100","$1,100"),
     ("Travel & Lodging",        "$4,200","$4,200"),
     ("Meals (50% rule)",        "$285",  "$143"),
     ("Insurance",               "$3,150","$3,150"),
     ("Education & Training",    "$480",  "$480"),
     ("Phone & Internet (40%)",  "$1,200","$480"),
     ("Miscellaneous",           "$290",  "$290")]
for i,(cat,sp,de) in enumerate(tax):
    ry=105+i*37; fill=CARD if i%2==0 else BG
    d2.rectangle([20,ry,800,ry+35],fill=fill)
    txt(d2,32, ry+11,cat,WHITE,11,False)
    txt(d2,342,ry+11,sp, DIM,  11,False)
    txt(d2,452,ry+11,de, GREEN,11,False)
ty=105+len(tax)*37+8
rct(d2,20,ty,800,ty+38,CARD,BLUE)
txt(d2,32, ty+11,"TOTAL DEDUCTIBLE",WHITE,12)
txt(d2,452,ty+11,"$21,781",GREEN,14)
img2.save(f"{BASE}/screenshot-tax.png","PNG")
print("✅ screenshot-tax.png")

# ── Synthetic CRM ──────────────────────────────────────────────────────────────
W3,H3=1200,680; img3=Image.new("RGB",(W3,H3),BG); d3=ImageDraw.Draw(img3)
txt(d3,40,25,"Executive Pipeline",WHITE,20)
txt(d3,40,54,"Client Relationship Management",MUTED,12,False)
rct(d3,40,78,320,132,CARD,BORDER)
txt(d3,54,89,"PIPELINE VALUE",MUTED,10,False)
txt(d3,54,108,"$4,800.00",BLUE,22)
cols=[
    ("LEADS",    "3",MUTED, ["#Inquiry — Drone Real Estate","#Brand Shoot — Startup","#Portrait Session"]),
    ("QUALIFIED","2",BLUE,  ["Studio Client D · $650","Studio Client E · $450"]),
    ("PROPOSAL", "2",ORANGE,["Studio Client F · $1,200","Studio Client G · $975"]),
    ("BOOKED",   "2",GREEN, ["Studio Client A · $1,200","Studio Client B · $975"]),
]
cx=40
for col_label,count,cc,leads in cols:
    rct(d3,cx,148,cx+272,178,CARD2,BORDER)
    txt(d3,cx+12,157,f"{col_label}  {count}",cc,11)
    for li,lt in enumerate(leads):
        cy=188+li*88
        rct(d3,cx,cy,cx+272,cy+78,CARD,BORDER)
        d3.ellipse([cx+12,cy+14,cx+23,cy+25],fill=cc)
        txt(d3,cx+32,cy+12,lt,WHITE,11,False)
        txt(d3,cx+12,cy+36,"Las Vegas, NV",MUTED,10,False)
        rct(d3,cx+12,cy+54,cx+88,cy+70,cc+"33",cc,4)
        txt(d3,cx+18,cy+58,col_label,cc,9)
    cx+=295
img3.save(f"{BASE}/screenshot-crm.png","PNG")
print("✅ screenshot-crm.png")
print("\n🎉 Done — saved directly to TTLM marketing folder.")

import sys; sys.exit(0)  # stop here — skip old masking code below


# ── Helpers ──────────────────────────────────────────────────────────────────

def redact(draw, x0, y0, x1, y1, fill="#1e293b", text=None, text_color="#475569", font=None):
    """Draw a filled rectangle and optionally center demo text inside it."""
    draw.rectangle([x0, y0, x1, y1], fill=fill)
    if text:
        tw, th = draw.textbbox((0, 0), text, font=font)[2:]
        tx = x0 + ((x1 - x0) - tw) // 2
        ty = y0 + ((y1 - y0) - th) // 2
        draw.text((tx, ty), text, fill=text_color, font=font)

# ── DASHBOARD (Operational Intelligence) ─────────────────────────────────────

img = Image.open(f"{BASE}/screenshot-dashboard-2.png").convert("RGBA")
d = ImageDraw.Draw(img)

# KPI card 1 — Active Subscriptions count
redact(d, 80,  148, 298, 195, text="12",          text_color="white")
# KPI card 2 — Approx Monthly Expense
redact(d, 312, 130, 588, 195, text="$1,240/mo",   text_color="#60a5fa")
# KPI card 3 — Committed Annual
redact(d, 598, 130, 870, 195, text="$14,880/yr",  text_color="white")
# KPI card 4 — Flagged For Review (number + exposure amount)
redact(d, 878, 120, 1160, 200, text="5  ·  $890/mo exposure", text_color="#f97316")

# Top spend bar — wipe entire row including all vendor labels and amounts
redact(d, 40, 214, 1160, 248, fill="#0f172a")

# Table — vendor names (VENDOR column x≈50–415) + amounts columns
rows_y = [308, 352, 395, 438, 481, 524, 567, 610, 653, 696]
demo_vendors  = ["Vendor A","Vendor B","Vendor C","Vendor D","Vendor E",
                 "Vendor F","Vendor G","Vendor H","Vendor I","Vendor J"]
demo_monthly  = ["$120/mo","$98/mo","$75/mo","$62/mo","$55/mo",
                 "$48/mo","$44/mo","$29/mo","$22/mo","$22/mo"]
demo_annual   = ["$1,440/yr","$1,176/yr","$900/yr","$744/yr","$660/yr",
                 "$576/yr","$528/yr","$348/yr","$264/yr","$264/yr"]

for i, y in enumerate(rows_y):
    # Vendor name column
    redact(d, 50,  y+2, 415, y+32, text=demo_vendors[i],  text_color="white")
    # EST. MONTHLY column
    redact(d, 430, y+2, 545, y+32, text=demo_monthly[i],  text_color="white")
    # PROJECTED ANNUAL column
    redact(d, 635, y+2, 760, y+32, text=demo_annual[i],   text_color="white")

img.save(f"{BASE}/screenshot-dashboard.png", "PNG")
print("✅ screenshot-dashboard.png saved")

# ── TAX (Schedule C) ─────────────────────────────────────────────────────────

img = Image.open(f"{BASE}/screenshot-tax.png").convert("RGBA")
d = ImageDraw.Draw(img)

# Total Spend column (~x 340–410) and Deductible Amount (~x 420–500)
tax_rows = [
    (47,  72,  "$312",    "$290"),
    (87,  112, "$6,200",  "$3,100"),
    (131, 156, "$3,800",  "$3,800"),
    (166, 191, "$2,950",  "$2,950"),
    (204, 229, "$480",    "$270"),
    (240, 265, "$1,100",  "$1,100"),
    (279, 304, "$4,200",  "$4,200"),
    (315, 340, "$285",    "$285"),
    (351, 376, "$3,150",  "$3,150"),
    (387, 412, "$3,800",  "$1,900"),
    (423, 448, "$2,400",  "$864"),
    (460, 485, "$90",     "$90"),
    (533, 558, "$2,800",  "$2,800"),
]

for (y0, y1, spend, deduct) in tax_rows:
    redact(d, 338, y0, 412, y1, text=spend,  text_color="white")
    redact(d, 420, y0, 500, y1, text=deduct, text_color="#10b981")

# Total line
redact(d, 338, 748, 510, 768, text="$21,000", text_color="white")

img.save(f"{BASE}/screenshot-tax.png", "PNG")
print("✅ screenshot-tax.png saved")

# ── CRM (Executive Pipeline) ─────────────────────────────────────────────────

img = Image.open(f"{BASE}/screenshot-crm.png").convert("RGBA")
d = ImageDraw.Draw(img)

# Pipeline Value KPI card
redact(d, 55, 188, 305, 240, text="$4,800.00", text_color="#60a5fa")

# Booked column — client names and amounts
# "FotoFetch" name + amount
redact(d, 835, 462, 1145, 497, fill="#1e293b", text="Studio Client A    $1,200.00", text_color="white")
# "Danett" name + amount
redact(d, 835, 586, 1145, 621, fill="#1e293b", text="Studio Client B    $975.00",   text_color="white")

# Column header amounts
redact(d, 820, 420, 1150, 445, fill="#1a2744", text="BOOKED 2    $2,175.00", text_color="#60a5fa")

img.save(f"{BASE}/screenshot-crm.png", "PNG")
print("✅ screenshot-crm.png saved")

print("\n🎉 All screenshots masked. Ready to commit and deploy.")
