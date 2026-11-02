import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(rows: Record<string, unknown>[], filename: string) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Pointages');
    XLSX.writeFile(book, filename);
}

export function exportToPdf(rows: Record<string, unknown>[], filename: string) {
    if (rows.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(12);
    doc.text('Consultation pointages OF', pageWidth / 2, 15, { align: 'center' });

    const headers = Object.keys(rows[0]);
    const body = rows.map((row) => headers.map((h) => String(row[h] ?? '')));

    autoTable(doc, {
        head: [headers],
        body,
        startY: 20,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2, fillColor: [255, 255, 255] },
        headStyles: {
            fontStyle: 'bold',
            fillColor: [245, 245, 245],
            textColor: [0, 0, 0],
        },
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            // Lignes 1, 3, 5… blanches — lignes 2, 4, 6… grises (comme la 3e)
            data.cell.styles.fillColor = data.row.index % 2 === 0 ? [255, 255, 255] : [245, 245, 245];
        },
        margin: { left: 14, right: 14 },
    });

    doc.save(filename);
}
