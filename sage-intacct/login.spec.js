require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
    let browser;
    try {
        // Check if environment variables are set
        if (!process.env.INTACCT_COMPANY || !process.env.INTACCT_LOGIN || !process.env.INTACCT_PASSWORD) {
            throw new Error('Environment variables for Intacct login are not set. Please set INTACCT_COMPANY, INTACCT_LOGIN, and INTACCT_PASSWORD.');
        }

        // Connect to the existing browser instance with remote debugging port
        browser = await chromium.connectOverCDP('http://localhost:9222');

        // Get all contexts or create a new one
        const context = browser.contexts().length > 0 ? browser.contexts()[0] : await browser.newContext();

        // Get all open pages in the browser
        const pages = await context.pages();

        // If there are no open pages, create a new one and navigate to the login page
        let page;
        if (pages.length === 0) {
            page = await context.newPage();
            await page.goto('https://www.intacct.com/ia/acct/login.phtml');
        } else {
            page = pages.find(p => p.url().includes('www.intacct.com/ia/acct/login.phtml')) || pages[0];
        }

        // Input username and password
        await page.fill('input[id="company"]', process.env.INTACCT_COMPANY);
        await page.fill('input[id="login"]', process.env.INTACCT_LOGIN);
        await page.fill('input[id="passwd"]', process.env.INTACCT_PASSWORD);
        await page.click('#rememberme');
        // submit
        await page.click('input[id="retbutton"]');

        // Wait for the applications dropdown to be visible and clickable
        await page.waitForSelector('#main-menu', { state: 'visible' });
        console.log('Applications dropdown is visible and clickable');

        // Click on the applications dropdown
        await page.click('#siaappsmenu .open-main');
        console.log('Clicked on the applications dropdown');

        // Click my instances
        await page.click('#cl');
        console.log('Clicked on My Instances');

        // Wait for the parent element with ID 'cl-all-Clients' to be visible
        await page.waitForSelector('#cl-all-Clients');
        console.log('Parent element cl-all-Clients is visible');

        // Find and click the <a> tag that contains the text 'My service authorizations' inside the element with ID 'cl-all-Clients'
        await page.click('#cl-all-Clients >> text=My service authorizations');
        console.log('Clicked on My service authorizations');

        console.log('Script completed');
    } catch (error) {
        console.error('An error occurred:', error.message);
    } finally {
        // Ensure the browser is closed
        if (browser) await browser.close();
        process.exit(0);
    }
})();
