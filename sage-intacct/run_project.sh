#!/bin/bash

# Function to run a command in a new terminal window
run_in_new_terminal() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell app \"Terminal\" to do script \"cd $(pwd) && $1\""
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux (assuming GNOME Terminal)
        gnome-terminal -- bash -c "cd $(pwd) && $1; exec bash"
    else
        echo "Unsupported operating system"
        exit 1
    fi
}

# Create the notice message
notice="
******************************************************************************
*                                                                            *
*                  IMPORTANT: LEAVE THIS WINDOW RUNNING                      *
*                                                                            *
*              The main script is running in the other window                *
*                                                                            *
******************************************************************************
"

# Run launchBrowser with the notice in a new terminal window
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    browser_pid=$(osascript -e "tell app \"Terminal\" to do script \"cd $(pwd) && echo '$notice' && node launchBrowser.spec.js && exit\"")
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux (assuming GNOME Terminal)
    browser_pid=$(gnome-terminal -- bash -c "cd $(pwd) && echo '$notice' && node launchBrowser.spec.js; exit" & echo $!)
else
    echo "Unsupported operating system"
    exit 1
fi

# Wait a bit for the browser to launch
sleep 5

# Display the notice
echo "
******************************************************************************
*                                                                            *
*                  IMPORTANT: LEAVE THIS WINDOW RUNNING                      *
*                                                                            *
*              Please check the other window for the menu options            *
*                                                                            *
******************************************************************************
"

while true; do
    echo "Please choose an option:"
    echo "1. Run login script"
    echo "2. Run payBill script"
    echo "3. Exit"
    read -p "Enter your choice (1-3): " choice

    case $choice in
        1)
            echo "Running login script..."
            node login.spec.js
            echo "Login script completed. Returning to menu..."
            ;;
        2)
            echo "Running payBill script..."
            node payBill.spec.js
            echo "PayBill script completed. Exiting..."
            exit 0
            ;;
        3)
            echo "Closing browser window and exiting..."
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                osascript -e "tell application \"Terminal\" to close (every window whose id is $browser_pid)"
            elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
                # Linux
                kill $browser_pid
            fi
            exit 0
            ;;
        *)
            echo "Invalid option. Please try again."
            ;;
    esac

    echo
done
