const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function compress() {
  const inPath = 'D:\\Vu Van Thanh\\Hồ sơ cá nhân\\Ho chieu\\Hochieu.pdf';
  const outPath = 'D:\\Vu Van Thanh\\Hồ sơ cá nhân\\Ho chieu\\Hochieu_compressed.pdf';
  
  if (!fs.existsSync(inPath)) {
    console.log('File not found:', inPath);
    return;
  }
  
  const size = fs.statSync(inPath).size;
  console.log(`Original size: ${(size / 1024 / 1024).toFixed(2)} MB`);
  
  try {
    const pdfBytes = fs.readFileSync(inPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const newPdfBytes = await pdfDoc.save({ useObjectStreams: false });
    fs.writeFileSync(outPath, newPdfBytes);
    
    const newSize = fs.statSync(outPath).size;
    console.log(`Node.js pdf-lib Compressed size: ${(newSize / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.error('Error compressing:', err);
  }
}
compress();
