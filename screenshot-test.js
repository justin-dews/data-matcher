const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to the upload page
    console.log('Navigating to upload page...');
    await page.goto('http://localhost:3000/dashboard/upload');
    
    // Wait a moment for the page to load
    await page.waitForTimeout(2000);
    
    // Take a full page screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: 'upload-page-screenshot.png', 
      fullPage: true 
    });
    
    console.log('Screenshot saved as upload-page-screenshot.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();