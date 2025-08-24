const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to home page...');
    await page.goto('http://localhost:3000');
    
    // Check if we're already logged in by trying to access dashboard
    console.log('Checking if already logged in...');
    await page.goto('http://localhost:3000/dashboard/upload');
    
    // Wait a moment and check if we're on login page or dashboard
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('/dashboard/upload')) {
      console.log('Already logged in! Taking screenshot of upload page...');
    } else {
      console.log('Not logged in. Please log in manually in the browser window.');
      console.log('Once logged in, navigate to /dashboard/upload and press Enter here...');
      
      // Wait for user input
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      await new Promise(resolve => {
        rl.question('Press Enter when you\'re ready to take the screenshot...', () => {
          rl.close();
          resolve();
        });
      });
    }
    
    // Take a full page screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: 'upload-page-with-data.png', 
      fullPage: true 
    });
    
    console.log('Screenshot saved as upload-page-with-data.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();