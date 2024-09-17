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
-   macOS (This project is built and tested on macOS. It may work on other operating systems, but functionality is not guaranteed.)

## Installation

1. Clone this repository:

    ```
    git clone https://github.com/arnoldsmyth/Intacct-Pay-Bills-from-CSV
    ```

2. Navigate to the project directory:

    ```
    cd Intacct-Pay-Bills-from-CSV/sage-intacct
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

2. In the `launchBrowser.spec.js` file, edit with a text editor to set the correct path for your browser. By default, it's set to:
    ```javascript
    const browserPath =
    	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    ```
    This is the default path for Google Chrome on macOS. If you're using a different browser or operating system, you'll need to update this path accordingly.

## Usage

1. Open a terminal and navigate to the `sage-intacct` directory.

2. Make the `run_project.sh` script executable:

    ```
    chmod +x run_project.sh
    ```

3. Run the automation script:
    ```
    ./run_project.sh
    ```

The `run_project.sh` script automates the process of running the Intacct automation scripts. Here's what it does:

1. Launches the browser by running `launchBrowser.spec.js` in a new terminal window.
2. Waits for 5 seconds to allow the browser to fully launch.
3. Presents the user with three options:
    - Run login script
    - Run payBill script
    - Exit
4. Based on the user's choice, it runs the appropriate script or exits.

When running the payBill script, you'll have the following options:

-   **Unattended Mode**: Choose between attended and unattended mode. In unattended mode, you can specify the number of invoices to process automatically before pausing for user input.
-   **Filter Sets**: Apply a filter set to process invoices for a specific month. Filter sets must be pre-configured in the Intacct Pay Bills screen in the format "MMM YYYY" (e.g., "Mar 2024").

This script provides a convenient way to manage the automation process, allowing users to log in and process bills as needed.

Note: This script is designed for macOS and Linux (GNOME) environments. Windows users may need to modify the script or run the Node.js scripts individually.

Alternatively, you can run the scripts individually:

1. Launch the browser and keep it running:

    ```
    node launchBrowser.spec.js
    ```

2. Open a new terminal window, navigate to the `sage-intacct` directory, and run the login script:

    ```
    node login.spec.js
    ```

3. After successful login, run the bill payment automation:
    ```
    node payBill.spec.js
    ```

When running `payBill.spec.js` individually, you'll be prompted to choose between attended and unattended mode, and whether to apply a filter set.

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
