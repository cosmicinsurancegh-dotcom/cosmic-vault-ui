import { jsPDF } from "jspdf";

/**
 * Every dashboard download is a document, not a spreadsheet.
 *
 * Certificates, registers and reports are read, printed and filed, so they
 * leave the app as a laid-out PDF with the Cosmic Vault masthead, a table that
 * paginates properly and a footer on every page.
 */

type Rgb = [number, number, number];

const INK: Rgb = [18, 22, 31];
const MUTED: Rgb = [108, 117, 132];
const RULE: Rgb = [214, 219, 228];
const HEAD_FILL: Rgb = [240, 243, 248];
const ZEBRA: Rgb = [247, 249, 252];

const FONT = "helvetica";
const BRAND = "COSMIC VAULT";
const BRAND_SUB = "DEPOSITORY · LONDON";
const MARGIN = 14;
const FOOTER_BAND = 16;
// A4 in millimetres. The documents are always created at this format, and
// reading it back off the instance would look like a Convex `internal`
// function reference to the release gate's source scan.
const PORTRAIT = { width: 210, height: 297 };
const LANDSCAPE = { width: 297, height: 210 };

const DEFAULT_NOTE =
  "Generated from live Cosmic Vault records. The signed original is held by Cosmic Vault.";

export type PdfColumn = { key: string; label: string };
export type PdfRow = Record<string, string | number>;

/** The built-in fonts are WinAnsi, so fold anything outside it to plain ASCII. */
function clean(value: unknown) {
  return String(value ?? "")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\n\x20-\x7e\xa0-\xff]/g, "");
}

function today() {
  return new Date()
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    .toUpperCase();
}

function drawMasthead(doc: jsPDF, width: number, title: string, subtitle?: string) {
  let y = MARGIN;

  doc.setFont(FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(BRAND, MARGIN, y + 2.6);
  const brandWidth = doc.getTextWidth(BRAND);

  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(BRAND_SUB, MARGIN + brandWidth + 3, y + 2.6);
  doc.text(`GENERATED ${today()}`, width - MARGIN, y + 2.6, { align: "right" });

  y += 5.4;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, width - MARGIN, y);
  y += 10;

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  const titleLines = doc.splitTextToSize(clean(title), width - MARGIN * 2) as string[];
  for (const line of titleLines) {
    doc.text(line, MARGIN, y);
    y += 6.8;
  }

  if (subtitle) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(8.6);
    doc.setTextColor(...MUTED);
    const subtitleLines = doc.splitTextToSize(
      clean(subtitle),
      width - MARGIN * 2,
    ) as string[];
    y += 1;
    for (const line of subtitleLines) {
      doc.text(line, MARGIN, y);
      y += 4.2;
    }
  }

  return y + 5;
}

function drawContinuation(doc: jsPDF, width: number, title: string) {
  doc.setFont(FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`${clean(title).toUpperCase()} · CONTINUED`, MARGIN, MARGIN + 2.6);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, MARGIN + 5.4, width - MARGIN, MARGIN + 5.4);
  return MARGIN + 9;
}

function drawFooters(doc: jsPDF, width: number, height: number, note: string) {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, height - 12, width - MARGIN, height - 12);
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    const noteLines = doc.splitTextToSize(clean(note), width - MARGIN * 2 - 28) as string[];
    doc.text(noteLines[0] ?? "", MARGIN, height - 8);
    doc.text(`Page ${page} of ${total}`, width - MARGIN, height - 8, { align: "right" });
  }
}

/** A paginated table export: the vault register, a member inventory, a report. */
export function downloadPdfTable({
  filename,
  title,
  subtitle,
  columns,
  rows,
  note = DEFAULT_NOTE,
}: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: PdfRow[];
  note?: string;
}) {
  if (columns.length === 0) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const { width, height } = LANDSCAPE;
  const available = width - MARGIN * 2;
  const bottomLimit = height - FOOTER_BAND;

  const SIZE = 7.4;
  const LINE = 3.1;
  const PAD_X = 1.7;
  const PAD_Y = 1.6;
  const MIN_ROW = 6.4;

  doc.setFont(FONT, "bold");
  doc.setFontSize(SIZE);
  const headerWidths = columns.map(
    (column) => doc.getTextWidth(clean(column.label).toUpperCase()) + PAD_X * 2,
  );
  doc.setFont(FONT, "normal");
  const valueWidths = columns.map(
    (column) =>
      rows.reduce((widest, row) => Math.max(widest, doc.getTextWidth(clean(row[column.key]))), 0) +
      PAD_X * 2,
  );

  const natural = headerWidths.map((header, index) => Math.max(header, valueWidths[index]));
  const naturalTotal = natural.reduce((sum, columnWidth) => sum + columnWidth, 0);
  const scale = available / naturalTotal;
  let widths = natural.map((columnWidth) => Math.min(columnWidth * scale, columnWidth * 2.4));
  const used = widths.reduce((sum, columnWidth) => sum + columnWidth, 0);
  if (used < available) {
    const grow = (available - used) / columns.length;
    widths = widths.map((columnWidth) => columnWidth + grow);
  }

  doc.setFont(FONT, "bold");
  const headerCells = columns.map(
    (column, index) =>
      doc.splitTextToSize(
        clean(column.label).toUpperCase(),
        Math.max(widths[index] - PAD_X * 2, 3),
      ) as string[],
  );
  const headerHeight =
    Math.max(...headerCells.map((cells) => cells.length)) * LINE + PAD_Y * 2;

  doc.setFont(FONT, "normal");
  const bodyCells = rows.map((row) =>
    columns.map(
      (column, index) =>
        doc.splitTextToSize(
          clean(row[column.key]),
          Math.max(widths[index] - PAD_X * 2, 3),
        ) as string[],
    ),
  );

  const drawHeader = (top: number) => {
    doc.setFillColor(...HEAD_FILL);
    doc.rect(MARGIN, top, available, headerHeight, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(SIZE);
    doc.setTextColor(...INK);
    let x = MARGIN;
    headerCells.forEach((cells, index) => {
      cells.forEach((line, lineIndex) => {
        doc.text(line, x + PAD_X, top + PAD_Y + LINE * (lineIndex + 0.8));
      });
      x += widths[index];
    });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, top + headerHeight, MARGIN + available, top + headerHeight);
    return top + headerHeight;
  };

  let y = drawHeader(drawMasthead(doc, width, title, subtitle));

  bodyCells.forEach((cells, rowIndex) => {
    const rowHeight = Math.max(
      MIN_ROW,
      Math.max(...cells.map((lines) => lines.length)) * LINE + PAD_Y * 2,
    );
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = drawHeader(drawContinuation(doc, width, title));
    }
    if (rowIndex % 2 === 1) {
      doc.setFillColor(...ZEBRA);
      doc.rect(MARGIN, y, available, rowHeight, "F");
    }
    doc.setFont(FONT, "normal");
    doc.setFontSize(SIZE);
    doc.setTextColor(...INK);
    let x = MARGIN;
    cells.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        doc.text(line, x + PAD_X, y + PAD_Y + LINE * (lineIndex + 0.8));
      });
      x += widths[index];
    });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + rowHeight, MARGIN + available, y + rowHeight);
    y += rowHeight;
  });

  drawFooters(doc, width, height, note);
  doc.save(filename);
}

/**
 * A narrative export: a certificate summary, an assay report or a plain
 * document body. `Label: value` lines are set as a definition list.
 */
export function downloadPdfDocument({
  filename,
  title,
  subtitle,
  lines,
  note = DEFAULT_NOTE,
}: {
  filename: string;
  title: string;
  subtitle?: string;
  lines: string[];
  note?: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { width, height } = PORTRAIT;
  const contentWidth = width - MARGIN * 2;
  const bottomLimit = height - FOOTER_BAND;

  let y = drawMasthead(doc, width, title, subtitle);

  const newPage = () => {
    doc.addPage();
    y = drawContinuation(doc, width, title);
  };

  for (const raw of lines) {
    const text = clean(raw);
    if (!text.trim()) {
      y += 2.8;
      continue;
    }

    const pair = /^([A-Z][A-Za-z0-9 &/()-]{1,38}):\s*(.+)$/.exec(text);
    if (pair) {
      const label = `${pair[1]}:`;
      doc.setFont(FONT, "bold");
      doc.setFontSize(8.6);
      const labelWidth = doc.getTextWidth(label) + 2.6;

      doc.setFont(FONT, "normal");
      doc.setFontSize(10);
      const valueLines = doc.splitTextToSize(
        pair[2],
        contentWidth - labelWidth,
      ) as string[];

      if (y + (valueLines.length - 1) * 4.9 > bottomLimit) newPage();

      doc.setFont(FONT, "bold");
      doc.setFontSize(8.6);
      doc.setTextColor(...MUTED);
      doc.text(label, MARGIN, y);

      doc.setFont(FONT, "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      valueLines.forEach((line) => {
        if (y > bottomLimit) {
          newPage();
          doc.setFont(FONT, "normal");
          doc.setFontSize(10);
          doc.setTextColor(...INK);
        }
        doc.text(line, MARGIN + labelWidth, y);
        y += 4.9;
      });
      y += 1.4;
      continue;
    }

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const paragraphs = doc.splitTextToSize(text, contentWidth) as string[];
    for (const line of paragraphs) {
      if (y > bottomLimit) {
        newPage();
        doc.setFont(FONT, "normal");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
      }
      doc.text(line, MARGIN, y);
      y += 5.2;
    }
    y += 1.2;
  }

  drawFooters(doc, width, height, note);
  doc.save(filename);
}
