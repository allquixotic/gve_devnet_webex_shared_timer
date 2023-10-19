let socket = io.connect('https://' + document.domain + ':' + location.port);
let arrowButtonsEnabled = true;
let isLocked = false;
let lockerID = null;
let isRunning = false;
let currentMinutes;
let currentSeconds;
let sessionLocks = {};

// Define the Webex application
var app = new window.Webex.Application();
// Extract meetingID from the URL
var urlParams = new URLSearchParams(window.location.search);
var meetingID = urlParams.get('meetingID');
var storedMeetingID = localStorage.getItem('meetingID');
var storedUrlToShareBase = localStorage.getItem('urlToShareBase');

// Construct the URL
var urlToNavigate = `${storedUrlToShareBase}/private_timer?meetingID=${encodeURIComponent(storedMeetingID)}`;


socket.on('connect', () => {
    console.error('Connected to Server');
    socket.emit('session_init', { sessionId: meetingID });
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

        isRunning = sessionData.running;
        currentMinutes = sessionData.minutes;
        currentSeconds = sessionData.seconds;
        updateTimerDisplay(currentMinutes, currentSeconds);

        // Check if the timer has reached zero and is running
        if (isRunning && currentMinutes === 0 && currentSeconds === 0) {
            playAlarmSound(); // Play the alarm sound when the timer hits zero and is running
            clearTimer();
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

function requestTimerUpdate() {
    // get timer time
    socket.emit('get_timer', { sessionId: meetingID });
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
}

socket.on('lock', function(data) {
    let sessionId = data.sessionId;
    sessionLocks[sessionId] = { isLocked: true, lockerID: data.lockerID };
    updateLockState(sessionId);
});

socket.on('unlock', function(data) {
    let sessionId = data.sessionId;
    sessionLocks[sessionId] = { isLocked: false, lockerID: null };
    updateLockState(sessionId);
});

function updateLockState(sessionId) {
    if (sessionId !== meetingID) {
        // If the session ID from the socket message does not match the current session ID, do nothing.
        return;
    }
    let lockState = sessionLocks[sessionId];

    if (lockState) {
        document.getElementById("lockSymbol").innerHTML = lockState.isLocked ? "&#128274;" : "&#128275;";
        disableControls(lockState.isLocked, sessionId);
    }
}

function toggleControls() {
    let currentSessionLock = sessionLocks[meetingID] || { isLocked: false, lockerID: null };
    if (!currentSessionLock.isLocked || (currentSessionLock.isLocked && socket.id === currentSessionLock.lockerID)) {
        currentSessionLock.isLocked = !currentSessionLock.isLocked;
        sessionLocks[meetingID] = currentSessionLock;
        socket.emit('toggle_lock', { locked: currentSessionLock.isLocked, sessionId: meetingID });
        updateLockState(meetingID);
    }
}
function disableControls(disabled) {
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
}


document.addEventListener("DOMContentLoaded", () => {
    requestTimerUpdate();
});


// Switch back to the shared timer view
function switchToSharedTimer() {
    document.getElementById('privateTimerContainer').style.display = 'none';
    document.getElementById('sharedTimerContainer').style.display = 'block';
}
// New function to handle the click on the private timer button
function switchToPrivateTimer() {
    document.getElementById('sharedTimerContainer').style.display = 'none'; // Hide shared timer, if there is one
    document.getElementById('privateTimerContainer').style.display = 'block'; // Show private timer
}

// Event listener for the private timer button
document.getElementById('privateTimerButton').addEventListener('click', showPrivateTimer);
