import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_pdf_invoice(payment: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0F172A"),
    )
    subtitle_style = ParagraphStyle(
        "SubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748B"),
    )
    right_align = ParagraphStyle(
        "RightAlign",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        alignment=2,
        textColor=colors.HexColor("#2563EB"),
    )

    # Header Table
    header_data = [
        [
            Paragraph("<b>KEVIN AI</b><br/><font size=9 color='#64748B'>AI-Powered Mock Interview Platform</font>", title_style),
            Paragraph(f"INVOICE<br/><font size=10 color='#0F172A'>#{payment.get('invoiceNumber', 'INV-001')}</font>", right_align),
        ]
    ]
    header_table = Table(header_data, colWidths=[3.5 * inch, 3.5 * inch])
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 15))

    # Divider line
    divider = Table([[""]], colWidths=[7 * inch], rowHeights=[2])
    divider.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E2E8F0"))]))
    story.append(divider)
    story.append(Spacer(1, 15))

    meta_style = ParagraphStyle("MetaText", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#334155"))
    created_at = payment.get("createdAt")
    date_str = created_at.strftime("%B %d, %Y") if isinstance(created_at, datetime) else str(created_at or "")

    bill_to = f"<b>Billed To:</b><br/>{payment.get('userName', 'Customer')}<br/>{payment.get('userEmail', '')}"
    invoice_meta = (
        f"<b>Invoice Date:</b> {date_str}<br/>"
        f"<b>Payment Method:</b> {payment.get('paymentMethod', 'Razorpay').upper()}<br/>"
        f"<b>Transaction ID:</b> {payment.get('paymentId', payment.get('transactionRef', 'N/A'))}<br/>"
        f"<b>Status:</b> <font color='#16A34A'><b>{payment.get('status', 'SUCCESS').upper()}</b></font>"
    )

    meta_table = Table([[Paragraph(bill_to, meta_style), Paragraph(invoice_meta, meta_style)]], colWidths=[3.5 * inch, 3.5 * inch])
    meta_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(meta_table)
    story.append(Spacer(1, 20))

    # Items Table
    th_style = ParagraphStyle("TH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#FFFFFF"))
    td_style = ParagraphStyle("TD", parent=styles["Normal"], fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#0F172A"))
    td_bold = ParagraphStyle("TDB", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#0F172A"))

    amount = float(payment.get("amount", 0))
    gst = float(payment.get("gstAmount", 0))
    total = float(payment.get("totalAmount", amount + gst))

    table_data = [
        [Paragraph("DESCRIPTION", th_style), Paragraph("QTY", th_style), Paragraph("UNIT PRICE (INR)", th_style), Paragraph("TOTAL (INR)", th_style)],
        [Paragraph(f"<b>{payment.get('planName', 'Kevin AI Subscription')}</b><br/><font size=8 color='#64748B'>Subscription Plan</font>", td_style), Paragraph("1", td_style), Paragraph(f"₹{amount:.2f}", td_style), Paragraph(f"₹{amount:.2f}", td_style)],
        ["", "", Paragraph("Subtotal:", td_bold), Paragraph(f"₹{amount:.2f}", td_style)],
        ["", "", Paragraph("GST (18%):", td_bold), Paragraph(f"₹{gst:.2f}", td_style)],
        ["", "", Paragraph("<b>Total Paid:</b>", td_bold), Paragraph(f"<b>₹{total:.2f}</b>", td_bold)],
    ]

    item_table = Table(table_data, colWidths=[3.2 * inch, 0.8 * inch, 1.5 * inch, 1.5 * inch])
    item_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 1), (-1, 1), 1, colors.HexColor("#E2E8F0")),
                ("BACKGROUND", (2, 4), (3, 4), colors.HexColor("#F8FAFC")),
            ]
        )
    )
    story.append(item_table)
    story.append(Spacer(1, 30))

    # Company Footer
    footer_text = Paragraph(
        "<b>Kevin AI Solutions Inc.</b> | Support: support@kevin-ai.com<br/>"
        "Thank you for choosing Kevin AI! This is a computer-generated tax invoice.",
        subtitle_style,
    )
    story.append(footer_text)

    doc.build(story)
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
