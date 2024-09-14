const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');  // To resolve the path to Brave

(async () => {
    // Browser executable paths
    // Uncomment the appropriate line for your OS and preferred browser

    // macOS paths
    // const browserPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    // const browserPath = '/Applications/Chromium.app/Contents/MacOS/Chromium';
    // const browserPath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

    // Windows paths
    // const browserPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    // const browserPath = 'C:\\Program Files\\Chromium\\Application\\chrome.exe';
    // const browserPath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

    // Set your preferred browser path here
    const browserPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    // Launch browser with remote debugging enabled
    const browser = await chromium.launch({
        headless: false,
        executablePath: browserPath,
        args: ['--remote-debugging-port=9222']  // Enable remote debugging
    });

    // Create a new browser context with a specific viewport size
    const context = await browser.newContext({
        viewport: { width: 1600, height: 1200 }  // Adjust these values as needed
    });

    // Open a new page
    const page = await context.newPage();

    // Enable JavaScript in the page context
    await context.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setViewportSize({ width: 1600, height: 1200 });  // Set the same size as the context

    // Navigate to a URL
    await page.goto('https://www.intacct.com/ia/acct/login.phtml');

    // Wait for some element on the page to ensure it's loaded
    await page.waitForSelector('input[id="retbutton"]');  // Example: wait for <h1> to be visible

    console.log('Browser is now open with remote debugging enabled. You can run additional scripts.');

    // Don't close the browser, leave it open
    process.stdin.resume();  // Keeps the process alive so the browser stays open
})();
