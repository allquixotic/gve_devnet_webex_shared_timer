console.log("timer.js loaded");

var meetingID = null;

function getMeetingID() {
    let urlParams = new URLSearchParams(window.location.search);
    let up = urlParams.get('meetingID');
    if(up && up != "null") {
        meetingID = up;
        console.log("Got meeting ID from URL");
    }
    else {
        try {
            let webex = new window.Webex.Application();
            webex.context.getMeeting().then((m) => {
                meetingID = m.id;
            }).catch((errore) => {console.error("Async error getting meeting ID: ", errore);});
        }
        catch(error) {
            console.error("Error getting meeting ID: ", error);
        };
    }
}

getMeetingID();

function getSocket() {
    try {
        console.log("Got Socket");
        return io.connect(`${window.location.protocol}//${window.location.host}`, {auth: {sessionId: meetingID}});
    }
    catch (error) {
        console.error("Error creating socket instance: ", error);
        return null;
    }
}

let arrowButtonsEnabled = true;
let isLocked = false;
let isRunning = false;
let currentMinutes;
let currentSeconds;
let sessionLocks = {};
var lockedForMe = false;
var clientTimerInterval;
var socket = getSocket();

function displayWarningIfNoMeetingID() {
    if (!meetingID || meetingID === '' || meetingID == 'null') {
        let warningMessage = 'Warning: No meeting ID was supplied. The timer will not function properly.';
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

socket.on('timer_update', function(data) {
    try {
        console.log('Received timer_update event:', data);

        // Extract the timer state for the specific meeting/session
        let sessionData = data.timerState;
        if (!sessionData) {
            console.error('No timer data found for the session:', meetingID);
            return;
        }

        let sessionId = data.sessionId;

        if(sessionId != meetingID) {
            console.log("Got timer update about a timer we don't care about");
            return;
        }
        sessionLocks[sessionId] = data.locked;
        lockedForMe = data.lockedForMe;
        updateLockState(data.locked, lockedForMe);

        isRunning = sessionData.running;
        currentMinutes = sessionData.minutes;
        currentSeconds = sessionData.seconds;
        updateTimerDisplay(currentMinutes, currentSeconds);
        if(sessionData.justFinished) {
            playAlarmSound();
            stopTimer(false);
        }

        // Check if the timer has reached zero and is running
        if (isRunning && (currentMinutes > 0 || currentSeconds > 0)) {
            startClientTimer(); // Start or restart the client-side timer
        }

        if(!isRunning && !sessionData.justFinished) {
            stopTimer(false);
        }
    } catch (error) {
        console.error('Error processing timer_update event:', error);
    }
});

function playAlarmSound() {
    // Play the alarm sound
    let alarmSound = document.getElementById('alarmSound');
    if (alarmSound) {
        console.log("Calling alarmSound.play()");
        alarmSound.play();
    }
}

function decrementClientTimer() {
    if (!isRunning) 
    {
        stopClientSideTimer();
        return; // Do nothing if the timer is not running
    }

    currentSeconds--;
    if (currentSeconds < 0) {
        currentMinutes--;
        currentSeconds = 59;
    }

    updateTimerDisplay(currentMinutes, currentSeconds);

    if (currentMinutes < 0) {
        // Stop the timer if it goes below 0
        currentMinutes = 0;
        currentSeconds = 0;
        clearTimer(false);
        return;
    }

    if (isRunning && currentMinutes === 0 && currentSeconds === 0) {
        clearTimer(false);
    }
}

function startClientTimer() {
    stopClientSideTimer();
    clientTimerInterval = setInterval(decrementClientTimer, 1000);
}

function updateTimerDisplay(minutes, seconds) {
    console.log(`updateTimerDisplay called with minutes: ${minutes}, seconds: ${seconds}, isRunning: ${isRunning}`);
    if (minutes !== null && seconds !== null) {
        let mps = minutes.toString().padStart(2, '0');
        let sps = seconds.toString().padStart(2, '0');
        document.getElementById('minutes').value = mps;
        document.getElementById('seconds').value = sps;
    }

    if (isRunning) {
        document.getElementById('playPauseIcon').src = '/images/pause-icon.png';
        document.getElementById('playPauseBtn').setAttribute('data-running', 'true');
    } else {
        document.getElementById('playPauseIcon').className = 'icon-play';
        document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
    }

    console.log('Updating timer display:', minutes, seconds);
}

function adjustTime(unit, direction) {
    console.log(`adjustTime called with unit: ${unit}, direction: ${direction}`);
    if (arrowButtonsEnabled) { 
        socket.emit("increment_timer", { direction: direction, unit: unit, sessionId: meetingID });
    }
}

function setTimerInput(unit, value) {
    console.log(`setTimerInput called with unit: ${unit}, value: ${value}`);
    socket.emit('set_timer', { unit: unit, value: value, sessionId: meetingID });
}

function setTimerInputMinutes() {
    setTimerInput('minutes', document.getElementById('minutes').value);
}

function setTimerInputSeconds() {
    setTimerInput('seconds', document.getElementById('seconds').value);
}

function handleInputKeyup(event, unit) {
    if (event.key === 'Enter') {
        const inputValue = parseInt(event.target.value, 10);
        if (!isNaN(inputValue)) {
            const newValue = Math.abs(inputValue);
            event.target.value = newValue.toString().padStart(2, '0');
            socket.emit('set_timer', { unit: unit, value: newValue, sessionId: meetingID});
        }
    }
}

function startTimer() {
    console.log('startTimer called');
    socket.emit('start_timer', { sessionId: meetingID });
    document.getElementById('playPauseIcon').src = '/images/pause-icon.png';  // change the icon to pause
    document.getElementById('playPauseBtn').setAttribute('data-running', 'true');
    isRunning = true;
}

function stopTimer(do_emit = false) {
    console.log('stopTimer called');
    if(do_emit) {
        socket.emit('stop_timer', { sessionId: meetingID });
    }
    document.getElementById('playPauseIcon').src = '/images/play-icon.png';
    document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
    isRunning = false;
}

function toggleTimer() {
    console.log('toggleTimer called');
    if (isRunning) {
        stopTimer(true);
    } else {
        startTimer();
    }
}
function resetTimer() {
    socket.emit('reset_timer', { sessionId: meetingID });
}

function stopClientSideTimer() {
    if(clientTimerInterval) {
        clearInterval(clientTimerInterval);
    }
    clientTimerInterval = null;
}

function clearTimer(do_emit = false) {
    console.log('clearTimer called');
    updateTimerDisplay(0, 0); // Optionally reset the display to 0:00
    if(do_emit) {
        socket.emit('clear_timer', { sessionId: meetingID });
    }
    // Update UI elements and internal state to reflect the timer is cleared/stopped
    isRunning = false;
    document.getElementById('playPauseIcon').src = '/images/play-icon.png'; // change the icon to play
    document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
    stopClientSideTimer();
}

function updateLockState(locked, lockedForMe) {
    let sharedTimerControls = document.querySelectorAll('#sharedTimerContainer .arrow, #sharedTimerContainer .icon-btn, #sharedTimerContainer .clear-btn, #sharedTimerContainer .reset-btn'); // Note the scoping to '#sharedTimerContainer'

    sharedTimerControls.forEach(button => {
        if (!button.classList.contains('lock-btn')) { // Check if the button does not have the 'lock-btn' class
            button.style.opacity = lockedForMe ? 0.3 : 1.0;
            button.disabled = lockedForMe;
        }
    });

    // Disable only the inputs inside the shared timer container.
    let sharedTimerInputs = document.querySelectorAll('#sharedTimerContainer input'); 
    sharedTimerInputs.forEach(input => {
        input.disabled = lockedForMe;
    });

    document.getElementById("lockSymbol").innerHTML = locked ? "&#128274;" : "&#128275;";

    document.getElementById('submitPin').disabled = locked;
    document.getElementById('unlockForMe').disabled = !locked;
    document.getElementById('unlockForAll').disabled = !locked;
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

