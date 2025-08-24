const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to upload page...');
    await page.goto('http://localhost:3000/dashboard/upload');
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Take a full page screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: 'authenticated-upload-page.png', 
      fullPage: true 
    });
    
    console.log('Screenshot saved as authenticated-upload-page.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();