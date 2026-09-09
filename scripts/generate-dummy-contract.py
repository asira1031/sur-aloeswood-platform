from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "legal" / "sur-tree-agreement-dummy-v1.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

green = colors.HexColor("#0B3D2E")
gold = colors.HexColor("#B38438")
ink = colors.HexColor("#17231E")
muted = colors.HexColor("#607068")
paper = colors.HexColor("#F7F5EE")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Brand", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=22, leading=27, textColor=green, alignment=TA_CENTER, spaceAfter=5 * mm))
styles.add(ParagraphStyle(name="Sub", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=gold, alignment=TA_CENTER, spaceAfter=7 * mm))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=green, spaceBefore=4 * mm, spaceAfter=2 * mm))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=15, textColor=ink, spaceAfter=2.5 * mm))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontName="Helvetica", fontSize=8, leading=12, textColor=muted))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D8D3C4"))
    canvas.line(18 * mm, 16 * mm, 192 * mm, 16 * mm)
    canvas.setFillColor(muted)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18 * mm, 10 * mm, "DUMMY TEMPLATE - FOR WORKFLOW TESTING ONLY - NOT A FINAL LEGAL CONTRACT")
    canvas.drawRightString(192 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=22 * mm, title="SUR Aloeswood Dummy Per-Tree Agreement", author="SUR Aloeswood Platform")
story = [
    Paragraph("SUR ALOESWOOD", styles["Brand"]),
    Paragraph("DUMMY PER-TREE AGREEMENT - VERSION SUR-TREE-DUMMY-01", styles["Sub"]),
    Table([
        ["Customer legal name", "{{CUSTOMER_LEGAL_NAME}}"],
        ["Official Tree ID", "{{TREE_ID}}"],
        ["Species", "Aquilaria malaccensis"],
        ["Care plan", "{{CARE_PLAN}}"],
        ["Contract record", "{{CONTRACT_ID}}"],
    ], colWidths=[48 * mm, 126 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), paper),
        ("TEXTCOLOR", (0, 0), (0, -1), green),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8D3C4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])),
    Spacer(1, 5 * mm),
    Paragraph("Important", styles["H2x"]),
    Paragraph("This document is a dummy workflow template only. It is not the final lawyer-reviewed agreement, is not for notarization, and must be replaced before public rollout.", styles["Bodyx"]),
    Paragraph("1. Tree package", styles["H2x"]),
    Paragraph("The customer purchases one managed agarwood tree package tied to the unique Tree ID shown above. Farm location, caretaker identity, and operational details remain private unless disclosure is required by law or the approved agreement.", styles["Bodyx"]),
    Paragraph("2. Care and records", styles["H2x"]),
    Paragraph("SUR and its authorized farm partners manage planting, QR tagging, care operations, evidence review, and customer updates according to the selected care plan and approved business rules.", styles["Bodyx"]),
    Paragraph("3. Risk and replacement", styles["H2x"]),
    Paragraph("Tree growth, survival, sale timing, buyer availability, market price, and profit are not guaranteed. Replacement decisions follow documented cause, farm responsibility, applicable policies, and the final signed agreement.", styles["Bodyx"]),
    Paragraph("4. Future sale and distribution", styles["H2x"]),
    Paragraph("Any future sale, customer distribution, referral amount, future fund entry, fee, tax, or deduction must follow the final signed agreement and verified external transaction records.", styles["Bodyx"]),
    Paragraph("5. Identity and electronic acceptance", styles["H2x"]),
    Paragraph("The customer legal name must match the approved identity record. The application records the authenticated account, contract version, acknowledgements, signature text, and signing time. The final legal process may require additional identity evidence and formalities.", styles["Bodyx"]),
    Paragraph("6. Privacy and documents", styles["H2x"]),
    Paragraph("Identity documents and signed records are private. Access, retention, correction, and deletion follow the declared business purpose, applicable law, and the company privacy policy.", styles["Bodyx"]),
    PageBreak(),
    Paragraph("SIGNATURE AND NOTARIZATION WORKFLOW", styles["Brand"]),
    Paragraph("DUMMY PAGE - REPLACE WITH LAWYER-APPROVED WORDING", styles["Sub"]),
    Paragraph("Customer acknowledgement", styles["H2x"]),
    Paragraph("I confirm that I reviewed the exact contract version associated with my Tree ID and that the legal name below is mine.", styles["Bodyx"]),
    Spacer(1, 9 * mm),
    Table([
        ["Customer legal name", "{{CUSTOMER_LEGAL_NAME}}"],
        ["Customer signature", "{{CUSTOMER_SIGNATURE}}"],
        ["Signed date/time", "{{CUSTOMER_SIGNED_AT}}"],
        ["Identity verification", "Approved KYC reference on file (do not print full ID number)"],
    ], colWidths=[48 * mm, 126 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), paper),
        ("TEXTCOLOR", (0, 0), (0, -1), green),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8D3C4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ])),
    Spacer(1, 10 * mm),
    Paragraph("Notarial completion", styles["H2x"]),
    Paragraph("This space is intentionally reserved. The Admin must not mark a record as notarized until the completed instrument is returned by the notary and uploaded as the final immutable copy.", styles["Bodyx"]),
    Spacer(1, 12 * mm),
    Table([
        ["Notary / office", "____________________________________________"],
        ["Notarial details", "____________________________________________"],
        ["Date completed", "____________________________________________"],
        ["Final document hash", "{{FINAL_DOCUMENT_SHA256}}"],
    ], colWidths=[48 * mm, 126 * mm], style=TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#D8D3C4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])),
    Spacer(1, 12 * mm),
    Paragraph("Workflow: Admin sends frozen version -> Customer reviews and signs -> Admin arranges lawful notarization -> Admin uploads final notarized PDF -> The same final copy becomes available to Admin and Customer.", styles["Smallx"]),
]

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
