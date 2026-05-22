import puppeteer from 'puppeteer';

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Browser launched');
        const page = await browser.newPage();
        console.log('Navigating...');
        await page.goto('http://books.toscrape.com');
        console.log('Page loaded');
        const title = await page.title();
        console.log(`Title: ${title}`);
        await browser.close();
        console.log('Done');
    } catch (err) {
        console.error('Error:', err);
    }
})();
