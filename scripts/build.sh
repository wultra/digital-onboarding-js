#!/bin/bash

SCRIPT_FOLDER=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

# This script builds the lib-cordova package. 
# If the -dev argument is provided, it continuously watches for changes and rebuilds the package, while also syncing the native files as symlinks for easier development.

pushd "${SCRIPT_FOLDER}/.."

if [[ "$1" == "-dev" ]]; then

    echo "Starting to continuously build cordova package..."

    # Start rollup (TS -> JS) in watch mode
    rollup -c "rollup.config.js" -w &
    ROLLUP_TASK_PID=$!

    # Start the script that updates the cordova app JS files
    node ./scripts/update-cordova-app-js.js &
    UPDATE_TASK_PID=$!

    cleanup() {
        # Stop the rollup and update tasks
        echo "Script is exiting, killing processes: ${ROLLUP_TASK_PID}, ${UPDATE_TASK_PID}"
        kill -9 "${ROLLUP_TASK_PID}" 2>/dev/null
        kill -9 "${UPDATE_TASK_PID}" 2>/dev/null
        wait "${ROLLUP_TASK_PID}" "${UPDATE_TASK_PID}" 2>/dev/null
    }

    # Trap EXIT
    trap cleanup EXIT

    # Wait for both background tasks to finish (they won't, until killed)
    wait "${ROLLUP_TASK_PID}" "${UPDATE_TASK_PID}"
else

    echo "Building cordova package..."
    # Build the package once (TS -> JS)
    rollup -c "rollup.config.js"
fi

popd