let privateTimerInterval;
let privateIsRunning = false;
let privateMinutes = 0;
let privateSeconds = 0;

// Variables to store the initial timer values
let initialPrivateMinutes = 0;
let initialPrivateSeconds = 0;

function adjustPrivateTime(unit, direction) {
    if (privateIsRunning) {
        return; // Don't allow adjustments while the timer is running
    }

    if (direction === 'up') {
        if (unit === 'minutes') {
            privateMinutes = (privateMinutes + 1) % 60;
        } else {
            privateSeconds = (privateSeconds + 1) % 60;
        }
    } else {
        if (unit === 'minutes') {
            privateMinutes = (privateMinutes - 1 + 60) % 60;
        } else {
            privateSeconds = (privateSeconds - 1 + 60) % 60;
        }
    }

    privateUpdateTimerDisplay();
}

function privateUpdateTimerDisplay() {
    const minutesDisplay = privateMinutes.toString().padStart(2, '0');
    const secondsDisplay = privateSeconds.toString().padStart(2, '0');
    document.getElementById('privateMinutes').value = minutesDisplay;
    document.getElementById('privateSeconds').value = secondsDisplay;
}

function togglePrivateTimer() {
    if (privateIsRunning) {
        clearInterval(privateTimerInterval);
        // Change the icon to a play icon when the timer is stopped
        document.getElementById('privatePlayPauseIcon').src = '/static/images/play-icon.png';
    } else {
        // Store the initial timer values before starting the timer
        initialPrivateMinutes = privateMinutes;
        initialPrivateSeconds = privateSeconds;

        privateTimerInterval = setInterval(privateUpdateTime, 1000);
        // Change the icon to a pause icon when the timer starts
        document.getElementById('privatePlayPauseIcon').src = '/static/images/pause-icon.png';
    }
    privateIsRunning = !privateIsRunning;
    privateUpdateTimerDisplay();
}

function clearPrivateTimer() {
    clearInterval(privateTimerInterval);
    privateIsRunning = false;
    privateMinutes = 0;
    privateSeconds = 0;
    privateUpdateTimerDisplay();
}
function resetPrivateTimer() {
    clearInterval(privateTimerInterval);
    privateIsRunning = false;

    // Reset to the initial values
    privateMinutes = initialPrivateMinutes;
    privateSeconds = initialPrivateSeconds;

    privateUpdateTimerDisplay();
}

function privateUpdateTime() {
    if (privateSeconds > 0) {
        privateSeconds--;
    } else if (privateMinutes > 0) {
        privateMinutes--;
        privateSeconds = 59;
    } else {
        clearInterval(privateTimerInterval);
        privateIsRunning = false;
        // Update the icon to a play icon when the timer hits zero
        document.getElementById('privatePlayPauseIcon').src = '/static/images/play-icon.png';
        // Here, you might want to do something when the timer reaches 0.
    }
    privateUpdateTimerDisplay();
}


function handlePrivateInputKeyup(event, unit) {
    if (event.key === 'Enter') {
        const inputValue = parseInt(event.target.value, 10);
        if (!isNaN(inputValue)) {
            if (unit === 'minutes') {
                privateMinutes = inputValue % 60;
            } else {
                privateSeconds = inputValue % 60;
            }
            privateUpdateTimerDisplay();
        }
    }
}

function initializePrivateTimer() {
    // Initialize the timer display
    privateUpdateTimerDisplay();
}

// Call the initialization function at the end of the script or when the DOM is fully loaded
initializePrivateTimer();
