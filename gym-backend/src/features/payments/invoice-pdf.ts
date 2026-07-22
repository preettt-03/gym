import { Response } from 'express';
import PDFDocument from 'pdfkit';

interface InvoiceData {
  invoiceNumber: string | null;
  issuedAt: Date;
  billedTo: { name: string | null; email: string };
  plan: { name: string; durationDays: number };
  amount: number;
  currency: string;
  gateway: string;
  status: string;
}

export function sendInvoicePdf(res: Response, invoice: InvoiceData) {
  const invoiceNumber = invoice.invoiceNumber || 'N-A';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.pdf"`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text('Gym Platform', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#666').text('Membership Invoice', 50, 75);

  doc
    .fontSize(10)
    .fillColor('#000')
    .text(`Invoice #: ${invoiceNumber}`, 350, 50, { align: 'right' })
    .text(`Date: ${invoice.issuedAt.toLocaleDateString()}`, 350, 65, { align: 'right' })
    .text(`Status: ${invoice.status}`, 350, 80, { align: 'right' });

  doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#ddd').stroke();

  doc.fontSize(11).font('Helvetica-Bold').text('Billed To', 50, 130);
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(invoice.billedTo.name || 'Member', 50, 148)
    .text(invoice.billedTo.email, 50, 163);

  const tableTop = 210;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Description', 50, tableTop);
  doc.text('Duration', 300, tableTop);
  doc.text('Amount', 460, tableTop, { width: 85, align: 'right' });
  doc.moveTo(50, tableTop + 18).lineTo(545, tableTop + 18).strokeColor('#ddd').stroke();

  const rowY = tableTop + 32;
  doc.font('Helvetica');
  doc.text(`${invoice.plan.name} membership`, 50, rowY, { width: 240 });
  doc.text(`${invoice.plan.durationDays} days`, 300, rowY);
  doc.text(`${invoice.currency} ${invoice.amount.toFixed(2)}`, 460, rowY, { width: 85, align: 'right' });

  doc.moveTo(50, rowY + 30).lineTo(545, rowY + 30).strokeColor('#ddd').stroke();

  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('Total', 350, rowY + 45);
  doc.text(`${invoice.currency} ${invoice.amount.toFixed(2)}`, 460, rowY + 45, { width: 85, align: 'right' });

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#888')
    .text(`Payment gateway: ${invoice.gateway}`, 50, rowY + 90)
    .text('This is a system-generated invoice.', 50, rowY + 104);

  doc.end();
}
