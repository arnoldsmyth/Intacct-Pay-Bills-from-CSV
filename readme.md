# Intacct Automation with Playwright

This project automates various tasks in Sage Intacct using Playwright, including logging in and applying payments to bills.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [CSV File Format](#csv-file-format)
6. [Scripts](#scripts)
7. [Error Handling](#error-handling)

## Prerequisites

-   Node.js (version 14 or higher)
-   npm (Node Package Manager)
-   A valid Sage Intacct account
-   Google Chrome, Chromium, or Brave Browser installed

## Installation

1. Clone this repository:

    ```
    git clone https://github.com/your-username/intacct-playwright-automation.git
    ```

2. Navigate to the project directory:

    ```
    cd intacct-playwright-automation/sage-intacct
    ```

3. Install the dependencies:
    ```
    npm install
    ```

## Configuration

1. Create a `.env` file in the `sage-intacct` directory with the following content:

    ```
    INTACCT_COMPANY=your_company_name
    INTACCT_LOGIN=your_login
    INTACCT_PASSWORD=your_password
    ```

2. In the `launchBrowser.spec.js` file, set the correct path for your browser:
    ```javascript
    const browserPath =
    	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    ```

## Usage

1. Open a terminal and navigate to the `sage-intacct` directory.

2. Launch the browser and keep it running:

    ```
    node launchBrowser.spec.js
    ```

3. Open a new terminal window, navigate to the `sage-intacct` directory, and run the login script:

    ```
    node login.spec.js
    ```

4. After successful login, run the bill payment automation:
    ```
    node payBill.spec.js
    ```

Alternatively, you can use the `run_project.sh` script to automate the process:

1. Make the script executable:

    ```
    chmod +x run_project.sh
    ```

2. Run the script:
    ```
    ./run_project.sh
    ```

## CSV File Format

The `bills.csv` file should have the following header format:
Invoice number,Payment number,Payment method,Payment date,Amount_1,Error,Error Message

-   `Invoice number`: The invoice number in Intacct
-   `Payment number`: A unique identifier for the payment
-   `Payment method`: Either "Check", "Bank Draft", or "Credit Card"
-   `Payment date`: The date of payment in a format that can be parsed by JavaScript's Date object
-   `Amount_1`: The payment amount
-   `Error`: Set to "true" if there's an error, otherwise leave blank
-   `Error Message`: Description of the error if applicable

## Scripts

1. `launchBrowser.spec.js`: Launches the browser with remote debugging enabled.
2. `login.spec.js`: Handles the login process for Sage Intacct.
3. `payBill.spec.js`: Automates the bill payment process.
4. `run_project.sh`: A shell script to run the entire automation process.

## Error Handling

The script handles various error scenarios:

-   Skips invoices that have already been processed (checks `error_transactions.csv`).
-   Log serrors to error_transactions.csv.
-   Logs successful transactions to successful_transactions.csv.
-   Provides user prompts for continuing the process and saving transactions.
-   For more detailed information about the implementation, refer to the individual script files.
