import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import arabicReshaper from 'arabic-reshaper';
import Bidi from 'bidi-js';

// --- ARABIC PROCESSING ---
const bidi = Bidi();

/**
 * Reshapes and reorders Arabic text for proper rendering in jsPDF.
 */
export const processArabic = (text: string): string => {
  if (!text) return '';
  const isArabic = /[\u0600-\u06FF]/.test(text);
  if (!isArabic) return text;

  try {
    // 1. Reshape
    // @ts-ignore
    const reshaped = (arabicReshaper.reshape || arabicReshaper.convertArabic || ((t: string) => t))(text);
    
    // 2. BiDi Reordering
    const levels = bidi.getEmbeddingLevels(reshaped, 'rtl');
    return bidi.getReorderedString(reshaped, levels);
  } catch (e) {
    console.error('Arabic processing failed:', e);
    return text;
  }
};

// --- CSV EXPORT ---
export const generateCSV = (data: any[], headers: string[], filename: string) => {
  if (!data || data.length === 0) return;

  // Extract keys logic - we use the keys from the first item to ensure consistent column order
  const keys = Object.keys(data[0]);
  
  // 1. Process Headers (Join with comma)
  const headerRow = headers.join(",");
  
  // 2. Process Data Rows
  // Every field MUST be wrapped in double quotes to handle commas or special chars within data
  const csvRows = data.map(item => 
    keys.map(key => {
      const val = item[key] !== undefined && item[key] !== null ? String(item[key]) : "";
      // Escape existing double quotes by doubling them
      return `"${val.replace(/"/g, '""')}"`;
    }).join(",")
  );
  
  // 3. Assemble Content
  // BOM (\uFEFF) for Arabic/UTF-8 support in Excel
  // sep=, directive to force Excel to use comma as separator regardless of locale
  const csvContent = "\uFEFF" + "sep=,\n" + headerRow + "\n" + csvRows.join("\n");
  
  // 4. Download Trigger
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --- PDF EXPORT ---
/**
 * Senior Architect Level Implementation for Unicode-safe PDF Generation.
 * Hardened against CID map misses and Unicode metadata errors.
 */
export const generatePDF = async (
  title: string, 
  headers: string[], 
  data: any[][], 
  filename: string,
  isRTL: boolean = false
) => {
  console.log('[Architect] Initializing hardened PDF pipeline...');
  
  // Positional constructor
  const doc = new jsPDF('p', 'mm', 'a4');

  try {
    // 1. Fetch Font
    const fontResponse = await fetch('/fonts/Cairo-Regular.ttf');
    if (!fontResponse.ok) throw new Error(`Font I/O Failure: ${fontResponse.status}`);
    const fontBuffer = await fontResponse.arrayBuffer();
    
    // 2. Binary to Base64 (Robust implementation)
    const bytes = new Uint8Array(fontBuffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    const base64Font = btoa(binary);

    // 3. VFS and Font Registration
    const fontFileName = 'Cairo-Regular.ttf';
    const fontName = 'Cairo';
    
    doc.addFileToVFS(fontFileName, base64Font);
    
    /**
     * CRITICAL: Register font with 'Identity-H' encoding.
     * This triggers the internal jsPDF TTF parser to generate the cid-to-gid map (widths metadata).
     */
    doc.addFont(fontFileName, fontName, 'normal', 'Identity-H');
    doc.addFont(fontFileName, fontName, 'bold', 'Identity-H');
    
    // Activate font immediately
    doc.setFont(fontName, 'normal');

    // 4. Header Section
    doc.setFontSize(18);
    // Sanitize and process title
    const safeTitle = processArabic(String(title || "")).trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    
    const pageWidth = doc.internal.pageSize.getWidth();
    if (isRTL) {
      const tw = doc.getTextWidth(safeTitle);
      doc.text(safeTitle, pageWidth - 14 - tw, 15);
    } else {
      doc.text(safeTitle, 14, 15);
    }

    // 5. Table Generation
    const sanitize = (val: any) => processArabic(String(val || "")).trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    const safeHeaders = headers.map(sanitize);
    const safeBody = data.map(row => row.map(sanitize));

    autoTable(doc, {
      startY: 25,
      head: [safeHeaders],
      body: safeBody,
      theme: 'grid',
      styles: {
        font: fontName,
        fontStyle: 'normal',
        fontSize: 10,
        halign: isRTL ? 'right' : 'left',
        textColor: [0, 0, 0]
      },
      headStyles: {
        font: fontName,
        fontStyle: 'normal',
        fillColor: [63, 81, 181],
        textColor: [255, 255, 255],
        halign: 'center'
      },
      didParseCell: (hookData) => {
        // Enforce font properties at the cell level to assist the width calculation engine
        hookData.cell.styles.font = fontName;
        hookData.cell.styles.fontStyle = 'normal';
      }
    });

    console.log('[Architect] Saving local stream...');
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('[Architect] Pipeline Exception:', error);
    throw error;
  }
};
