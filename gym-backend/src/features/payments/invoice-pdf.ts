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
  /** UPI UTR, card slip or gateway id. */
  reference?: string | null;
}

// Kept in sync with gym-user-frontend/src/lib/brand.ts.
const GYM = {
  name: "KING'S FITNESS",
  address: 'Dharmat Rd, near Ranjit Hanuman Mandir, Fatehabad, Madhya Pradesh 453551',
  phone: '+91 75667 78296',
};
const GOLD = '#ac9a5f';
const METHOD: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', RAZORPAY: 'Razorpay (online)', STRIPE: 'Stripe', WALLET: 'Wallet' };

export function sendInvoicePdf(res: Response, invoice: InvoiceData) {
  const invoiceNumber = invoice.invoiceNumber || 'N-A';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.pdf"`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  doc.rect(0, 0, 595.28, 6).fill(GOLD);
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111').text(GYM.name, 50, 50);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(GYM.address, 50, 75, { width: 280 }).text(GYM.phone, 50, 99);
  doc.fontSize(10).fillColor(GOLD).font('Helvetica-Bold').text('MEMBERSHIP INVOICE', 50, 118);

  doc
    .fontSize(10)
    .fillColor('#000')
    .text(`Invoice #: ${invoiceNumber}`, 350, 50, { align: 'right' })
    .text(`Date: ${invoice.issuedAt.toLocaleDateString()}`, 350, 65, { align: 'right' })
    .text(`Status: ${invoice.status}`, 350, 80, { align: 'right' });

  doc.moveTo(50, 140).lineTo(545, 140).strokeColor('#ddd').stroke();

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Billed To', 50, 156);
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(invoice.billedTo.name || 'Member', 50, 174)
    .text(invoice.billedTo.email, 50, 189);

  const tableTop = 230;
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
    .text(`Paid via: ${METHOD[invoice.gateway] ?? invoice.gateway}${invoice.reference ? `   ·   Ref: ${invoice.reference}` : ''}`, 50, rowY + 90)
    .text(`Thank you for training with ${GYM.name}. This is a system-generated invoice.`, 50, rowY + 104);

  doc.end();
}
