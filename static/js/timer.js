let arrowButtonsEnabled = true;
let isLocked = false;
let isRunning = false;
let currentMinutes;
let currentSeconds;
let sessionLocks = {};
var lockedForMe = false;

// Define the Webex application
var app = new window.Webex.Application();
// Extract meetingID from the URL
var urlParams = new URLSearchParams(window.location.search);
var meetingID = urlParams.get('meetingID');
var clientTimerInterval;
let socket = io.connect(`${window.location.protocol}//${window.location.host}`, {auth: {sessionId: meetingID}});

function displayWarningIfNoMeetingID() {
    if (!meetingID || meetingID === '') {
        let warningMessage = 'Warning: No meeting ID was supplied. The timer will not function properly.';
        // Display this message on the page
        let warningDiv = document.createElement("div");
        warningDiv.style.color = "red";
        warningDiv.style.fontWeight = "bold";
        warningDiv.style.fontSize = "20px";
        warningDiv.style.textAlign = "center";
        warningDiv.style.padding = "10px 0";
        warningDiv.innerHTML = warningMessage;
        document.body.insertBefore(warningDiv, document.body.firstChild);
    }
}

socket.on('connect', () => {
    console.error('Connected to Server');
});

socket.on('connect_error', (error) => {
    console.error('Connection failed:', error);
});

socket.on('timer_update', function(data) {
    try {
        console.log('Received timer_update event:', data);

        // Extract the timer state for the specific meeting/session
        let sessionData = data[meetingID];
        if (!sessionData) {
            console.error('No timer data found for the session:', meetingID);
            return;
        }

        let sessionId = data.sessionId;
        sessionLocks[sessionId] = data.locked;
        lockedForMe = data.lockedForMe;
        updateLockState(sessionId);

        isRunning = sessionData.running;
        currentMinutes = sessionData.minutes;
        currentSeconds = sessionData.seconds;
        updateTimerDisplay(currentMinutes, currentSeconds);

        // Check if the timer has reached zero and is running
        if (isRunning && currentMinutes === 0 && currentSeconds === 0) {
            playAlarmSound(); // Play the alarm sound when the timer hits zero and is running
            clearTimer();
        }
        else {
            startClientTimer(); // Start or restart the client-side timer
        }
    } catch (error) {
        console.error('Error processing timer_update event:', error);
    }
});

function playAlarmSound() {
    // Play the alarm sound
    let alarmSound = document.getElementById('alarmSound');
    if (alarmSound) {
        alarmSound.play();
    }
}

// Function to decrement the timer
function decrementTimer() {
    if (!isRunning) return; // Do nothing if the timer is not running

    currentSeconds--;
    if (currentSeconds < 0) {
        currentMinutes--;
        currentSeconds = 59;
    }

    if (currentMinutes < 0) {
        // Stop the timer if it goes below 0
        clearTimer();
        return;
    }

    if (isRunning && currentMinutes === 0 && currentSeconds === 0) {
        playAlarmSound(); // Play the alarm sound when the timer hits zero and is running
        clearTimer();
    }

    updateTimerDisplay(currentMinutes, currentSeconds);
}

function startClientTimer() {
    if (clientTimerInterval) clearInterval(clientTimerInterval); // Clear existing interval
    clientTimerInterval = setInterval(decrementTimer, 1000); // Set new interval
}

function updateTimerDisplay(minutes, seconds) {
    console.log(`updateTimerDisplay called with minutes: ${minutes}, seconds: ${seconds}`);
    if (minutes !== null && seconds !== null) {
        document.getElementById('minutes').value = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').value = seconds.toString().padStart(2, '0');
    }

    if (isRunning) {
        // document.getElementById('playPauseIcon').className = 'icon-pause';
        document.getElementById('playPauseIcon').src = '/static/images/pause-icon.png';
        document.getElementById('playPauseBtn').setAttribute('data-running', 'true');
    } else {
        document.getElementById('playPauseIcon').className = 'icon-play';
        document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
    }

    console.log('Updating timer display:', minutes, seconds);
}

function adjustTime(unit, direction) {
    if (arrowButtonsEnabled) { // Check if arrow buttons are enabled
        let eventName = direction === 'up' ? 'increment_timer' : 'decrement_timer';
        socket.emit(eventName, { unit: unit, sessionId: meetingID });
    }
}

function handleInputKeyup(event, unit) {
    if (event.key === 'Enter') {
        const inputValue = parseInt(event.target.value, 10);
        if (!isNaN(inputValue)) {
            // Ensure the input value is within a valid range (0-59 for minutes and seconds)
            const newValue = Math.min(Math.max(inputValue, 0), unit === 'minutes' ? 99 : 99);

            // Update the input field with the formatted value
            event.target.value = newValue.toString().padStart(2, '0');

            // Update the timer using the adjusted value
            socket.emit('set_timer', { unit: unit, value: newValue, sessionId: meetingID});
        }
    }
}

function startTimer() {
    console.log('startTimer called');
    socket.emit('start_timer', { sessionId: meetingID });
    document.getElementById('playPauseIcon').src = '/static/images/pause-icon.png';  // change the icon to pause
    document.getElementById('playPauseBtn').setAttribute('data-running', 'true');
    isRunning = true;  // Update the isRunning variable
}

function stopTimer() {
    console.log('stopTimer called');
    socket.emit('stop_timer', { sessionId: meetingID });
    document.getElementById('playPauseIcon').src = '/static/images/play-icon.png';
    document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
    isRunning = false;  // Update the isRunning variable
}


function toggleTimer() {
    console.log('toggleTimer called');
    if (isRunning) {
        stopTimer();
    } else {
        startTimer();
    }
}
function resetTimer() {
    socket.emit('reset_timer', { sessionId: meetingID });
}

function clearTimer() {
    console.log('clearTimer called');
    socket.emit('clear_timer', { sessionId: meetingID });
    // Update UI elements and internal state to reflect the timer is cleared/stopped
    isRunning = false;  // Update the isRunning variable
    document.getElementById('playPauseIcon').src = '/static/images/play-icon.png'; // change the icon to play
    document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
    clearInterval(clientTimerInterval); // Stop the client-side timer
    isRunning = false;  // Update the isRunning variable
    updateTimerDisplay(0, 0); // Optionally reset the display to 0:00
}

function updateLockState(sessionId) {
    if (sessionId !== meetingID || !sessionLocks.hasOwnProperty(sessionId)) {
        // If the session ID from the socket message does not match the current session ID, do nothing.
        return;
    }

    let lockState = sessionLocks[sessionId];
    let disabled = lockedForMe;
    // Select only the elements inside the shared timer container.
    let sharedTimerControls = document.querySelectorAll('#sharedTimerContainer .arrow, #sharedTimerContainer .icon-btn, #sharedTimerContainer .clear-btn, #sharedTimerContainer .reset-btn'); // Note the scoping to '#sharedTimerContainer'

    sharedTimerControls.forEach(button => {
        if (!button.classList.contains('lock-btn')) { // Check if the button does not have the 'lock-btn' class
            button.style.opacity = disabled ? 0.3 : 1.0;
            button.disabled = disabled;
        }
    });

    // Disable only the inputs inside the shared timer container.
    let sharedTimerInputs = document.querySelectorAll('#sharedTimerContainer input'); // Scoped to '#sharedTimerContainer'
    sharedTimerInputs.forEach(input => {
        input.disabled = disabled;
    });

    // If you want to update lock symbol inside the shared timer only, make sure its ID is unique and it's inside the '#sharedTimerContainer'.
    document.getElementById("lockSymbol").innerHTML = disabled ? "&#128274;" : "&#128275;";
    // Update the arrowButtonsEnabled flag based on the lock state
    arrowButtonsEnabled = !disabled;

    document.getElementById('submitPin').disabled = disabled;
    document.getElementById('unlockForMe').disabled = !disabled;
    document.getElementById('unlockForAll').disabled = !disabled;
}

document.addEventListener("DOMContentLoaded", () => {
    displayWarningIfNoMeetingID();
    document.getElementById('lockControlsBtn').addEventListener('click', function() {
        var pinModal = document.getElementById('pinModal');
        pinModal.style.display = "block";
    });
    // Close the modal if the user clicks on <span> (x)
    document.querySelector('.close').addEventListener('click', function() {
        document.getElementById('pinModal').style.display = "none";
        document.getElementById('pinError').style.display = "none"; // Hide error message when closing modal
    });
    socket.emit('get_timer', { sessionId: meetingID });
});

document.getElementById('submitPin').addEventListener('click', function() {
    var pin = document.getElementById('pinInput').value.trim();
    var pinError = document.getElementById('pinError');
    if (pin.length === 6) {
        socket.emit('toggle_lock', { sessionId: meetingID, pin: pin });
        pinError.style.display = "none"; // Hide error message
    } else {
        pinError.innerText = "Please enter a 6-digit PIN.";
        pinError.style.display = "block"; // Show error message
    }
    var pinModal = document.getElementById('pinModal');
    pinModal.style.display = "none";
});

document.getElementById('unlockForMe').addEventListener('click', function() {
    var pin = document.getElementById('pinInput').value;
    var pinError = document.getElementById('pinError');
    if (pin.length === 6) {
        socket.emit('toggle_lock', { sessionId: meetingID, pin: pin, unlockFor: 'me' });
        pinError.style.display = "none";
    } else {
        pinError.innerText = "Please enter a 6-digit PIN.";
        pinError.style.display = "block";
    }
    var pinModal = document.getElementById('pinModal');
    pinModal.style.display = "none";
});

document.getElementById('unlockForAll').addEventListener('click', function() {
    var pin = document.getElementById('pinInput').value;
    var pinError = document.getElementById('pinError');
    if (pin.length === 6) {
        socket.emit('toggle_lock', { sessionId: meetingID, pin: pin, unlockFor: 'all' });
        pinError.style.display = "none";
    } else {
        pinError.innerText = "Please enter a 6-digit PIN.";
        pinError.style.display = "block";
    }
    var pinModal = document.getElementById('pinModal');
    pinModal.style.display = "none";
});

