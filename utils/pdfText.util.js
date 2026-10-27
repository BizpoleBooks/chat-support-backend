const PDFParser = require("pdf2json");

function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text; // fallback if malformed
  }
}

function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on("pdfParser_dataError", err => {
      reject(err.parserError);
    });

    pdfParser.on("pdfParser_dataReady", pdfData => {
      try {
        const text = pdfData.Pages
          .map(page =>
            page.Texts
              .map(t => {
                if (!t.R || !t.R[0] || !t.R[0].T) return "";
                return safeDecode(t.R[0].T);
              })
              .join(" ")
          )
          .join("\n\n");

        resolve(text.trim() || "No readable text found in PDF.");
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

module.exports = { extractPdfText };
