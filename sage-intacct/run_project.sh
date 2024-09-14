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

# Run launchBrowser in a new terminal window
run_in_new_terminal "node launchBrowser.spec.js"

# Wait a bit for the browser to launch
sleep 5

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
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "Invalid option. Please try again."
            ;;
    esac

    echo
done
