import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

type Cell = string | number;

function escapeCsv(val: Cell) {
  const str = String(val ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function sendCsv(res: Response, filename: string, headers: string[], rows: Cell[][]) {
  const lines = [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(lines.join('\n'));
}

export async function sendXlsx(res: Response, filename: string, headers: string[], rows: Cell[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function sendPdf(res: Response, filename: string, title: string, headers: string[], rows: Cell[][]) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  doc.fontSize(18).text(title);
  doc.moveDown();

  const colWidth = (doc.page.width - 80) / headers.length;

  function drawRow(cells: Cell[], font: 'Helvetica' | 'Helvetica-Bold') {
    if (doc.y > doc.page.height - 60) doc.addPage();
    const y = doc.y;
    doc.fontSize(9).font(font);
    cells.forEach((cell, i) => doc.text(String(cell ?? ''), 40 + i * colWidth, y, { width: colWidth }));
    doc.moveDown();
  }

  drawRow(headers, 'Helvetica-Bold');
  rows.forEach((row) => drawRow(row, 'Helvetica'));

  doc.end();
}

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export async function sendReport(
  res: Response,
  format: ReportFormat,
  filename: string,
  title: string,
  headers: string[],
  rows: Cell[][]
) {
  if (format === 'csv') return sendCsv(res, filename, headers, rows);
  if (format === 'xlsx') return sendXlsx(res, filename, headers, rows);
  return sendPdf(res, filename, title, headers, rows);
}
