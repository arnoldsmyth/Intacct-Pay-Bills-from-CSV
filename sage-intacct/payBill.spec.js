// Import required modules
const { chromium } = require('playwright');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const readline = require('readline');

// Define file paths
const csvFilePath = 'bills.csv';
const successFileName = 'successful_transactions.csv';
const errorFileName = 'error_transactions.csv';

// Global variables for script execution mode
let isUnattendedMode = true;
let unattendedInvoiceCount = 0;
let maxUnattendedInvoices = 5;

// Variable to store selected filter
let selectedFilter = null;

// Configuration and Setup
// ----------------------
// This script automates bill payment processes in Sage Intacct.
// It reads from a CSV file, processes invoices, and logs results.
// The script can run in attended or unattended mode, with options
// for filtering and error reprocessing.

// Key components:
// 1. File handling: Reading from and writing to CSV files
// 2. Browser automation: Using Playwright to interact with Sage Intacct
// 3. User interaction: Prompts for mode selection and invoice processing
// 4. Error handling: Logging errors and skipped transactions

/********************************************************************************
                    1. Initialization and Setup Functions
********************************************************************************/
// Ensure CSV files exist with headers
function ensureCsvExists(fileName, headers) {
    if (!fs.existsSync(fileName)) {
        // If the file does not exist, create it and write the headers
        fs.writeFileSync(fileName, headers.join(',') + '\n');
    } else {
        // If the file exists, check its contents
        const fileContent = fs.readFileSync(fileName, 'utf8');
        const existingHeaders = fileContent.split('\n')[0]; // Get the first line (headers)

        // Check if the existing headers match the expected headers
        if (existingHeaders !== headers.join(',')) {
            // If they don't match, insert the headers at the top
            fs.writeFileSync(fileName, headers.join(',') + '\n' + fileContent);
        }
    }
}

// Prompt user to reprocess invoices in the error file
async function promptForReprocessErrors() {
    console.log('Do you want to reprocess invoices in the error file? (N/Enter for No, Y for Yes)');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const response = await new Promise(resolve => {
        rl.question('', answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });

    // Set default to 'N' if the response is not 'y'
    return response === 'y';
}

// Prompt user to select between Attended and Unattended mode
async function promptForMode() {
    console.log('Select mode: (U/Enter for Unattended, A for Attended)');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const response = await new Promise(resolve => {
        rl.question('', answer => {
            rl.close();
            resolve(answer.trim().toUpperCase());
        });
    });

    return response === 'A' ? 'A' : 'U';
}

// Prompt user for the number of invoices to process in unattended mode
async function promptForInvoiceCount() {
    console.log('Enter the number of invoices to process in unattended mode (default 5):');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const response = await new Promise(resolve => {
        rl.question('', answer => {
            rl.close();
            resolve(answer.trim());
        });
    });

    const count = parseInt(response);
    return isNaN(count) ? 5 : count;
}

// Prompt user if they want to apply a filter set
async function promptForFilterSet(parentIframe) {
    //this should prompt the user if they want to apply a filterset
    //default is y/enter
    //return a true or false
    console.log('Do you want to apply a filterSet? (Y/Enter for Yes, N for No)');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const response = await new Promise(resolve => {
        rl.question('', answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });

    return response === 'y' || response === '';
}

// Generate filter options for the last 12 months
const generateFilterOptions = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const filterOptions = [];

    for (let i = 0; i < 12; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthName = months[date.getMonth()];
        const year = date.getFullYear();
        filterOptions.push(`${monthName} ${year}`);
    }

    return filterOptions;
};

// Prompt user to select a filter set from the generated options
const promptUserForFilterSet = async (options) => {
    console.log('Select a filter set:');
    options.forEach((option, index) => console.log(`${index + 1}: ${option}`));

    const response = await chooseFilterSet();
    const selectedIndex = parseInt(response) - 1;

    if (selectedIndex >= 0 && selectedIndex < options.length) {
        return options[selectedIndex];
    } else {
        console.log('Invalid selection. Please try again.');
        return promptUserForFilterSet(options); // Recursively call if invalid input
    }
};

// Helper function for promptUserForFilterSet to get user input
const chooseFilterSet = () => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Enter your selection: ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
};

/********************************************************************************
                        2. Main Processing Functions
********************************************************************************/
// Get the invoice number for the current row
async function getInvoiceNumber(rowIndex, parentIframe) {
    try {
        const selector = `#_obj__PAYABLES_${rowIndex}_-_obj__RECORDID`;
        //wait for loading
        await waitForLoading(parentIframe);

        // Check if the element exists
        const elementExists = await parentIframe.locator(selector).first().count() > 0;

        if (!elementExists) {
            //console.error(`No more rows found at index ${rowIndex}. Returning null.`);
            return null;
        }

        await parentIframe.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 });
        const element = parentIframe.locator(selector).first();
        const invoiceNumber = await element.innerText();
        return invoiceNumber;
    } catch (error) {
        if (error.message.includes('Timeout')) {
            console.log('Timeout occurred while getting invoice number. Exiting script.');
            process.exit(1);
        }
        throw error;
    }
}
// Check the checkbox for a specific invoice
async function checkInvoiceCheckbox(invoiceNumber, parentIframe) {
    const rowIndex = await findRowIndexForInvoice(invoiceNumber, parentIframe);

    if (rowIndex !== null) {
        console.log(`Found row index for invoice ${invoiceNumber}: ${rowIndex}`);
        const checkboxSelector = `#_obj__PAYABLES_${rowIndex}_-_obj__SELECTED`;
        await parentIframe.locator(checkboxSelector).check();
        console.log(`Checked checkbox for invoice ${invoiceNumber}`);
    } else {
        console.log(`Could not find row for invoice ${invoiceNumber}`);
        // Log to error CSV
        appendToCsv(errorFileName, [
            `"${invoiceNumber}"`,  // Wrap invoice number in quotes
            'N/A',
            'Error',
            'Invoice not found in Intacct'
        ]);
        throw new Error(`Invoice ${invoiceNumber} not found in Intacct`);
    }
}

// Find the row index for a specific invoice number
async function findRowIndexForInvoice(invoiceNumber, parentIframe) {
    try {
        // First, determine the number of rows on the page
        let rowCount = 0;
        while (true) {
            const selector = `#_obj__PAYABLES_${rowCount}_-_obj__RECORDID`;
            const element = await parentIframe.locator(selector).first();
            if (!(await element.count())) {
                break; // Exit the loop when we can't find any more rows
            }
            rowCount++;
        }

        console.log(`Total rows on the page: ${rowCount}`);

        // Now search through the existing rows
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            const selector = `#_obj__PAYABLES_${rowIndex}_-_obj__RECORDID`;
            const element = await parentIframe.locator(selector).first();
            const currentInvoiceNumber = await element.innerText();

            if (compareInvoiceNumbers(currentInvoiceNumber, invoiceNumber)) {
                return rowIndex;
            }
        }

        // If we've searched all rows and haven't found a match
        const errorMessage = `Invoice ${invoiceNumber} not found in ${rowCount} rows.`;
        console.log(errorMessage);
        appendToCsv(errorFileName, [
            `"${invoiceNumber}"`,  // Wrap invoice number in quotes
            'N/A',
            'Error',
            errorMessage
        ]);
        return null;
    } catch (error) {
        const errorMessage = `Error while searching for invoice ${invoiceNumber}: ${error.message}`;
        console.error(errorMessage);
        appendToCsv(errorFileName, [
            `"${invoiceNumber}"`,  // Wrap invoice number in quotes
            'N/A',
            'Error',
            errorMessage
        ]);
        return null;
    }
}

// Select the appropriate payment method and set the payment date
async function selectPaymentMethod(paymentMethod, parentIframe, paymentDate, page) {
    const selectSelector = '#_obj__PAYMENTMETHOD_D';
    let optionValue;

    switch (paymentMethod.toLowerCase()) {
        case 'check':
        case 'bank draft':
            optionValue = 'EFT';
            break;
        case 'credit card':
            optionValue = 'Credit Card';
            break;
        default:
            console.log(`Unhandled payment method: ${paymentMethod}. No selection made.`);
            return;
    }

    try {
        await parentIframe.locator(selectSelector).selectOption(optionValue);
        console.log(`Selected payment method: ${optionValue}`);

        await waitForLoading(parentIframe);

        if (optionValue === 'EFT') {
            //pause 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));
            await selectBank(parentIframe);
        } else if (optionValue === 'Credit Card') {
            //pause 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));
            await selectCreditCard(parentIframe);
        }

        await waitForLoading(parentIframe);

        await setPaymentDate(parentIframe, paymentDate);
    } catch (error) {
        console.error('Error in selectPaymentMethod:', error);
        throw error; // Re-throw the error to be caught by the caller
    }
}

// Select the credit card for payment
async function selectCreditCard(parentIframe) {
    const dropdownToggleSelector = '#span__obj__CREDITCARD';
    const creditCardSelectSelector = '#_c_obj__CREDITCARDsel';
    const desiredCreditCardOption = 'CC_Truist';

    try {
        // Click the dropdown toggle to open the credit card selection
        await parentIframe.locator(dropdownToggleSelector).click();
        console.log('Clicked credit card dropdown toggle');

        // Wait for the credit card select element to be visible
        await parentIframe.locator(creditCardSelectSelector).waitFor({ state: 'visible', timeout: 10000 });

        // Wait for the options to be available
        await parentIframe.locator(`${creditCardSelectSelector} option`).first().waitFor({ state: 'attached', timeout: 10000 });

        // Select the desired credit card option
        await parentIframe.locator(creditCardSelectSelector).selectOption({ label: desiredCreditCardOption });

        console.log(`Selected credit card: ${desiredCreditCardOption}`);
    } catch (error) {
        console.error('Error in selectCreditCard:', error);
        throw error;
    }
}

// Select the bank for payment
async function selectBank(parentIframe) {
    const dropdownToggleSelector = '#span__obj__FINANCIALENTITY';
    const bankSelectSelector = '#_c_obj__FINANCIALENTITYsel';
    const desiredBankOption = 'CK_Operating x4047--Truist';

    // Click the dropdown toggle to open the bank selection
    await parentIframe.locator(dropdownToggleSelector).click();
    console.log('Clicked bank dropdown toggle');

    // Wait for the bank select element to be visible
    await parentIframe.locator(bankSelectSelector).waitFor({ state: 'visible' });

    // Select the desired bank option
    await parentIframe.locator(bankSelectSelector).selectOption({ label: desiredBankOption });

    console.log(`Selected bank: ${desiredBankOption}`);
}

// Set the payment date in the form
async function setPaymentDate(parentIframe, paymentDate) {
    const dateInputSelector = '#_obj__WHENPAID';

    // Convert the date to mm/dd/yyyy format
    const formattedDate = formatDate(paymentDate);

    // Clear the existing value and type the new date
    await parentIframe.locator(dateInputSelector).fill('');
    await parentIframe.locator(dateInputSelector).fill(formattedDate);

    console.log(`Set payment date to: ${formattedDate}`);
}

// Check if the selected amount matches the expected amount
async function checkSelectedAmount(parentIframe, expectedAmount) {
    try {
        // Use the .grid_total class to find the PAYMENTAMOUNT
        const selectedAmountSelector = '#tfooter__obj__PAYABLES .grid_total[id$="-_obj__PAYMENTAMOUNT"]';
        const selectedAmountText = await parentIframe.locator(selectedAmountSelector).innerText();

        // Extract the numeric value from the selected amount text
        const selectedAmount = parseFloat(selectedAmountText.replace(/,/g, ''));

        // Parse the expected amount, removing any currency symbols and commas
        const parsedExpectedAmount = parseFloat(expectedAmount.replace(/[$,]/g, ''));

        if (selectedAmount === parsedExpectedAmount) {
            console.log(`✅ Selected amount (${selectedAmount}) matches the expected amount (${parsedExpectedAmount})`);
        } else {
            console.log(`❌ Mismatch in amounts: Selected (${selectedAmount}) vs Expected (${parsedExpectedAmount})`);
            throw new Error(`Selected amount (${selectedAmount}) does not match expected amount (${parsedExpectedAmount})`);
        }
    } catch (error) {
        // console.error('Error in checkSelectedAmount:', error);
        throw error; // Re-throw the error to be caught by the caller
    }
}

// Prompt the user to save or cancel the transaction
async function promptForSave(parentIframe) {
    if (isUnattendedMode) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await parentIframe.locator('button:has-text("Save")').click();
        console.log('Clicked Save button (Unattended mode)');
        return true;
    }

    console.log('Ready to Save? (Y/Enter to save, N to cancel)');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const response = await new Promise(resolve => {
        rl.question('', answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (response === 'y' || response === '') {
        await parentIframe.locator('button:has-text("Save")').click();
        console.log('Clicked Save button');
        return true;
    } else {
        await parentIframe.locator('button:has-text("Cancel")').click();
        console.log('Clicked Cancel button');
        return false;
    }
}

/********************************************************************************
                    3. CSV and File Handling Functions
********************************************************************************/
// Append data to a CSV file
function appendToCsv(fileName, data) {
    const csvLine = `${data.join(',')}\n`;
    fs.appendFileSync(fileName, csvLine);
}

// Read data from a CSV file
const readCsv = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
};

/********************************************************************************
                4. UI Interaction and Navigation Functions
********************************************************************************/
// Get the correct frame for interacting with the page
async function getCorrectFrame(page) {
    const mainFrame = page.frameLocator('#iamain');
    return mainFrame;
}

// Wait for the page to finish loading
async function waitForLoading(parentIframe) {
    try {
        // Wait for the presence of the specified element
        await parentIframe.locator('#_obj__PAYABLES_0_-_obj__VENDORNAME').waitFor({ state: 'visible', timeout: 30000 });

        // console.log('Page loaded successfully');
    } catch (error) {
        if (error.message.includes('Timeout')) {
            console.log('Timeout occurred while waiting for page to load. Exiting script.');
            process.exit(1);
        }
        throw error; // Re-throw the error to be caught by the caller
    }
}

// Clear the vendor filter from the page
async function clearVendorFilter(parentIframe) {
    try {
        // Clear the vendor filter input field
        await parentIframe.locator('[id="_obj__VENDORIDRANGESTART_D"]').fill('');
        await parentIframe.getByRole('button', { name: 'Apply filter' }).click();

        // Wait for the loading overlay after clicking Clear filter
        await waitForLoading(parentIframe);

        console.log('Filter cleared successfully');
    } catch (error) {
        console.error('Error clearing filter:', error);
    }
}

// Select the filter set on the page
const selectFilterSet = async (parentIframe, selectedFilter) => {
    // Click on the filter dropdown
    await parentIframe.locator('#span__obj__ADVANCEDFILTER').click();

    // Select the filter set
    await parentIframe.locator(`#_c_obj__ADVANCEDFILTERsel option:has-text("${selectedFilter}")`).click();
    // Click the Apply filter button
    await parentIframe.locator('button:has-text("Apply filter")').click();
    console.log(`Filter "${selectedFilter}" applied successfully.`);
};

/********************************************************************************
                        5. Utility Functions
********************************************************************************/
// Compare two invoice numbers, ignoring leading zeros
function compareInvoiceNumbers(invoiceNumber1, invoiceNumber2) {
    const normalize = (num) => num.replace(/^0+/, '');
    return normalize(invoiceNumber1) === normalize(invoiceNumber2);
}

// Format a date string to mm/dd/yyyy format
function formatDate(dateString) {
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

// Prompt the user to continue or exit the script
async function promptToContinue() {
    if (isUnattendedMode) {
        return true;
    }

    console.log('Continue? (Y/Enter to continue, N to exit)');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const response = await new Promise(resolve => {
        rl.question('', answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });

    return response === 'y' || response === '';
}

(async () => {
    // Add this prompt at the beginning of the main function
    const reprocessErrors = await promptForReprocessErrors();
    if (reprocessErrors) {
        fs.writeFileSync(errorFileName, ''); // Clear the error file
        console.log('Error file cleared. Reprocessing invoices.');
    } else {
        console.log('Continuing without reprocessing invoices in the error file.');
    }

    // Ensure CSV files exist
    ensureCsvExists(successFileName, ['Invoice Number', 'Payment Number', 'Status']);
    ensureCsvExists(errorFileName, ['Invoice Number', 'Payment Number', 'Status', 'Error Message']);

    // Prompt for unattended mode
    const mode = await promptForMode();
    if (mode === 'U') {
        isUnattendedMode = true;
        maxUnattendedInvoices = await promptForInvoiceCount();
    }

    //prompt for filter set
    const filterSet = await promptForFilterSet();

    if (filterSet) {
        // Ask for filter input at the beginning
        const filterOptions = generateFilterOptions();
        selectedFilter = await promptUserForFilterSet(filterOptions);
    }

    // Connect to the existing browser instance with remote debugging port
    const browser = await chromium.connectOverCDP('http://localhost:9222');

    // Get all contexts or create a new one
    const context = browser.contexts().length > 0 ? browser.contexts()[0] : await browser.newContext();

    // Get all open pages in the browser
    const pages = await context.pages();

    // If there are open pages, select the one you need, otherwise open a new page
    let page;
    if (pages.length > 0) {
        page = pages.find(p => p.url().includes('www-p504.intacct.com'));
        if (!page) {
            console.error('Error: No page with URL containing "www-p504.intacct.com" found.');
            await browser.close();
            process.exit(1);
        }
    } else {
        console.error('Error: No open pages found.');
        await browser.close();
        process.exit(1);
    }

    // Replace line 79 with this:
    const parentIframe = await getCorrectFrame(page);

    //apply the filter set
    if (filterSet && selectedFilter) {
        //select the filter set on the page
        await selectFilterSet(parentIframe, selectedFilter);

    }



    let rowIndex = 0;
    let invoiceNumber;

    while (true) {

        //get the invoice number we are processing
        invoiceNumber = await getInvoiceNumber(rowIndex, parentIframe);
        if (invoiceNumber === null) {
            console.log('No more invoice numbers available. Exiting script.');
            break; // or process.exit(0);
        }
        //check error file for invoice number and skip it in the browser if it exists
        const errorRows = await readCsv(errorFileName);
        if (errorRows.length > 0) {
            const errorInvoiceNumbers = errorRows.map(row => row['Invoice Number'].replace(/^"|"$/g, '').trim());
            if (errorInvoiceNumbers.includes(invoiceNumber)) {
                rowIndex++;
                continue;
            }
        }

        // Log the summary of skipped invoices
        console.log(`Skipped ${rowIndex} invoices that have already been processed.`);

        // Replace the existing prompt with this condition
        if (!isUnattendedMode) {
            console.log(`Do you want to process invoice number: ${invoiceNumber}?`);
            const shouldProcessInvoice = await promptToContinue();
            if (!shouldProcessInvoice) {
                await clearVendorFilter(parentIframe);
                console.log('User chose to stop. Exiting script.');
                process.exit(0);
            }
        }

        console.log(`Processing invoice number: ${invoiceNumber}`);

        //lok up the data in the csv
        const findMatchingRows = () => {
            return new Promise((resolve, reject) => {
                // Initialize variables
                let matchingInvoiceRow = null;
                let matchingPaymentRows = [];
                let hasError = false;
                let errorMessage = '';
                let paymentNumber = null;

                // First pass: Read the CSV file to find the matching invoice
                fs.createReadStream(csvFilePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        // Strip quotes from invoice number
                        const invoiceNumberFromCsv = row['Invoice number'].replace(/^"|"$/g, '').trim(); // Remove quotes and trim whitespace
                        if (compareInvoiceNumbers(invoiceNumberFromCsv, invoiceNumber)) {
                            matchingInvoiceRow = row;
                            paymentNumber = row['Payment number'].replace(/^"|"$/g, ''); // Remove quotes from payment number
                            hasError = row['Error']?.toLowerCase() === 'true';
                            if (hasError) {
                                errorMessage = row['Error Message'] || 'CSV Error - payment and payment number amounts dont match';
                            }
                        }
                    })
                    .on('end', () => {
                        // Check for missing invoice or payment number
                        if (!matchingInvoiceRow) {
                            resolve({ status: 'skip', reason: 'No matching invoice found', paymentNumber: null });
                            return;
                        }
                        if (!paymentNumber || paymentNumber.trim() === '') {
                            resolve({ status: 'skip', reason: 'Missing or blank payment number', paymentNumber: null });
                            return;
                        }

                        // Second pass: Find all rows with the matching payment number
                        fs.createReadStream(csvFilePath)
                            .pipe(csv())
                            .on('data', (row) => {
                                const paymentNumberFromCsv = row['Payment number'].replace(/^"|"$/g, ''); // Remove quotes from payment number
                                if (paymentNumberFromCsv === paymentNumber) {
                                    matchingPaymentRows.push(row);
                                    if (row['Error']?.toLowerCase() === 'true') {
                                        hasError = true;
                                        errorMessage = row['Error Message'] || 'Unknown error in CSV';
                                    }
                                }
                            })
                            .on('end', () => {
                                if (matchingPaymentRows.length === 0) {
                                    resolve({ status: 'skip', reason: 'No matching payment rows found', paymentNumber });
                                } else if (hasError) {
                                    resolve({ status: 'error', reason: errorMessage, matchingInvoiceRow, matchingPaymentRows });
                                } else {
                                    resolve({ status: 'success', matchingInvoiceRow, matchingPaymentRows });
                                }
                            })
                            .on('error', (error) => {
                                reject(error);
                            });
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });
        };


        // Get the details of the first bill in the intacct list within the parent iframe and filter by vendor name
        const vendorName = await parentIframe.locator(`[id="_obj__PAYABLES_${rowIndex}_-_obj__VENDORNAME"]`).innerText();
        await parentIframe.locator('[id="_obj__VENDORIDRANGESTART_D"]').fill(vendorName);

        // Click the Apply filter button
        await parentIframe.getByRole('button', { name: 'Apply filter' }).click();

        // Replace the try-catch block and subsequent waits with:
        await waitForLoading(parentIframe);

        console.log('Filter applied successfully');

        console.log('Vendor Name:', vendorName);

        try {
            const result = await findMatchingRows();
            switch (result.status) {
                case 'skip':
                    console.log(`Skipping invoice ${invoiceNumber}: ${result.reason}`);
                    // Log skipped transaction to error CSV
                    appendToCsv(errorFileName, [
                        `"${invoiceNumber}"`,  // Wrap invoice number in quotes
                        result.paymentNumber || 'N/A',  // Include payment number if available
                        'Skipped',
                        result.reason
                    ]);
                    // Clear the filter
                    await clearVendorFilter(parentIframe);
                    break;
                case 'error':
                    console.log(`Error for invoice ${invoiceNumber}: ${result.reason}`);
                    // Log error to CSV
                    appendToCsv(errorFileName, [
                        `"${invoiceNumber}"`,  // Wrap invoice number in quotes
                        result.matchingPaymentRows[0]?.['Payment number'] || 'N/A',
                        'Error',
                        result.reason
                    ]);
                    // Clear the filter
                    await clearVendorFilter(parentIframe);
                    break;
                case 'success':
                    console.log('Matching invoice row found:', result.matchingInvoiceRow);
                    console.log('Number of rows with matching payment number:', result.matchingPaymentRows.length);

                    // Create a Set to store unique invoice numbers
                    const uniqueInvoiceNumbers = new Set();

                    // Select the payment method and set the payment date
                    const paymentMethod = result.matchingPaymentRows[0]['Payment method'];
                    const paymentDate = result.matchingPaymentRows[0]['Payment date'];
                    const expectedAmount = result.matchingPaymentRows[0]['Amount_1'];
                    try {
                        await selectPaymentMethod(paymentMethod, parentIframe, paymentDate, page);
                    } catch (error) {
                        // console.error('Error processing invoice:', error);
                        // Log error to CSV
                        appendToCsv(errorFileName, [
                            `"${invoiceNumber}"`,  // Wrap invoice number in quotes
                            result.matchingPaymentRows[0]?.['Payment number'] || 'N/A',
                            'Error',
                            error.message
                        ]);
                        rowIndex++;
                        await clearVendorFilter(parentIframe);
                        break;
                    }

                    // Check the checkboxes for each unique invoice
                    for (const row of result.matchingPaymentRows) {
                        const invoiceNumber = row['Invoice number'];
                        if (!uniqueInvoiceNumbers.has(invoiceNumber)) {
                            try {
                                await checkInvoiceCheckbox(invoiceNumber, parentIframe);
                                uniqueInvoiceNumbers.add(invoiceNumber);
                            } catch (error) {
                                console.error(`Error processing invoice ${invoiceNumber}:`, error.message);
                                // The error has already been logged to CSV in checkInvoiceCheckbox
                                break; // Exit the loop if an invoice is not found
                            }
                        }
                    }
                    console.log(`Checked ${uniqueInvoiceNumbers.size} unique invoices`);

                    // Now check the selected amount
                    try {
                        await checkSelectedAmount(parentIframe, expectedAmount);
                    } catch (error) {
                        // console.error('Error processing invoice:', error);
                        // Log error to CSV
                        appendToCsv(errorFileName, [
                            `"${invoiceNumber}"`,  // Wrap invoice number in quotes
                            result.matchingPaymentRows[0]?.['Payment number'] || 'N/A',
                            'Error',
                            error.message
                        ]);
                        rowIndex++;
                        await clearVendorFilter(parentIframe);
                        break;
                    }

                    // Click the "Pay now" button
                    //delay 3 seconds
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    await parentIframe.locator('#paynowid').click();
                    console.log('Clicked "Pay now" button');

                    // Wait for the memo field to be visible
                    await parentIframe.locator('#_obj__MOREDETAILSPAGE-_obj__MOREDETAILS_0_-_obj__DESCRIPTION').waitFor({ state: 'visible' });

                    // Enter the Payment number into the memo field
                    const paymentNumber = result.matchingPaymentRows[0]['Payment number'];
                    await parentIframe.locator('#_obj__MOREDETAILSPAGE-_obj__MOREDETAILS_0_-_obj__DESCRIPTION').fill(paymentNumber);
                    console.log(`Entered Payment number ${paymentNumber} into memo field`);

                    // Add this call after entering the Payment number into the memo field
                    const saveResult = await promptForSave(parentIframe);

                    if (saveResult) {
                        // Log success after the save operation
                        console.log(`Successfully processed invoice: ${invoiceNumber}`);
                        appendToCsv(successFileName, [
                            `"${invoiceNumber}"`,  // Wrap invoice number in quotes
                            result.matchingPaymentRows[0]?.['Payment number'] || 'N/A',
                            'Success'
                        ]);

                        // Add this block to handle unattended mode limits
                        if (isUnattendedMode) {
                            unattendedInvoiceCount++;
                            if (unattendedInvoiceCount >= maxUnattendedInvoices) {
                                console.log(`Processed ${unattendedInvoiceCount} invoices in unattended mode. Pausing for input.`);
                                isUnattendedMode = false;
                                unattendedInvoiceCount = 0;
                                await clearVendorFilter(parentIframe);
                                const shouldContinue = await promptToContinue();
                                if (!shouldContinue) {
                                    console.log('User chose to stop. Exiting script.');
                                    process.exit(0);
                                }
                                isUnattendedMode = true;
                                maxUnattendedInvoices = await promptForInvoiceCount();
                            }
                        }
                    } else {
                        // Log skipped transaction to error CSV
                        console.log(`Skipped invoice: ${invoiceNumber}`);
                        appendToCsv(errorFileName, [
                            `"${invoiceNumber}"`,  // Wrap invoice number in quotes
                            result.matchingPaymentRows[0]?.['Payment number'] || 'N/A',
                            'Skipped',
                            'User cancelled the save operation'
                        ]);
                    }

                    // Clear the filter
                    await clearVendorFilter(parentIframe);

                    // Reset the row index for the next iteration
                    rowIndex = 0;
                    break;
            }
        } catch (error) {
            console.error('Error in findMatchingRows:', error);
            // Handle unexpected errors
            appendToCsv(errorFileName, [
                `"${invoiceNumber}"`,  // Wrap invoice number in quotes
                'N/A',
                'Error',
                error.message
            ]);
            // Clear the filter
            await clearVendorFilter(parentIframe);
        }
    }

    console.log('Step: Script completed successfully');
    process.exit(0);  // 0 means successful exit
})();