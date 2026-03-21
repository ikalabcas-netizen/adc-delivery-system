const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const htmlPath = path.resolve(__dirname, 'android-install-guide.html');
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 15000 });
  
  const pdfPath = path.resolve(__dirname, 'ADC-Delivery-Android-Install-Guide-v1.0.0.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });
  
  console.log('PDF saved to:', pdfPath);
  await browser.close();
})();
