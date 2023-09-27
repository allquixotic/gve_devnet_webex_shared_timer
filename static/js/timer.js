let socket = io.connect('https://' + document.domain + ':' + location.port);
let arrowButtonsEnabled = true;
let isLocked = false;
let lockerID = null;
let isRunning = false;
let currentMinutes, currentSeconds;

socket.on('connect', () => {
    console.error('Connected to Server');
});

socket.on('connect_error', (error) => {
    console.error('Connection failed:', error);
});

socket.on('timer_update', function(data) {
    try{
        console.log('Received timer_update event:', data);

        isRunning = data.running;
        currentMinutes = data.minutes;
        currentSeconds = data.seconds;
        updateTimerDisplay(currentMinutes, currentSeconds);
        } catch (error) {
            console.error('Error processing timer_update event:', error);
        }
});

function updateTimerDisplay(minutes, seconds) {
    console.log(`updateTimerDisplay called with minutes: ${minutes}, seconds: ${seconds}`);
    if (minutes !== null && seconds !== null) {
        document.getElementById('minutes').value = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').value = seconds.toString().padStart(2, '0');
    }

    if (isRunning) {
        document.getElementById('playPauseImg').src = "/static/images/pause-icon.png";
        document.getElementById('playPauseBtn').setAttribute('data-running', 'true');
    } else {
        document.getElementById('playPauseImg').src = "/static/images/play-icon.png";
        document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
    }

    console.log('Updating timer display:', minutes, seconds);
}

function requestTimerUpdate() {
    // get timer time
    socket.emit('get_timer');
}

function adjustTime(unit, direction) {
    if (arrowButtonsEnabled) { // Check if arrow buttons are enabled
        let eventName = direction === 'up' ? 'increment_timer' : 'decrement_timer';
        socket.emit(eventName, { unit: unit });
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
            socket.emit('set_timer', { unit: unit, value: newValue });
        }
    }
}

function startTimer() {
    console.log('startTimer called');
    socket.emit('start_timer');
    document.getElementById('playPauseImg').src = "/static/images/pause-icon.png";
    document.getElementById('playPauseBtn').setAttribute('data-running', 'true');
    isRunning = true;  // Update the isRunning variable
}

function stopTimer() {
    console.log('stopTimer called');
    socket.emit('stop_timer');
    document.getElementById('playPauseImg').src = "/static/images/play-icon.png";
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
    socket.emit('reset_timer');
}

function clearTimer() {
    socket.emit('clear_timer');
}

function disableControls(disabled) {
    let arrows = document.querySelectorAll('.arrow');
    let otherButtons = document.querySelectorAll('.icon-btn, .arrow, .clear-btn, .reset-btn'); // Add dots before class names

    [...arrows, ...otherButtons].forEach(button => {
        if (!button.classList.contains('lock-btn')) { // Check if the button does not have the 'lock-btn' class
            button.style.opacity = disabled ? 0.3 : 1.0;
            button.disabled = disabled;
        }
    });

    let inputs = [document.getElementById('minutes'), document.getElementById('seconds')];
    inputs.forEach(input => {
        input.disabled = disabled;
    });

    document.getElementById("lockSymbol").innerHTML = disabled ? "&#128274;" : "&#128275;";
    // Update the arrowButtonsEnabled flag based on the lock state
    arrowButtonsEnabled = !disabled;
}

function toggleControls() {
    if (!isLocked || (isLocked && socket.id === lockerID)) {
        isLocked = !isLocked;
        socket.emit('toggle_lock', { locked: isLocked });
        disableControls(isLocked);
    }
}

socket.on('lock', function(data) {
    isLocked = true;
    lockerID = data.lockerID;
    document.getElementById("lockSymbol").innerHTML = "&#128274;"; // Unicode unlock symbol
    disableControls(true);
});

socket.on('unlock', function(data) {
    isLocked = false;
    lockerID = null;
    document.getElementById("lockSymbol").innerHTML = "&#128275;"; // Unicode unlock symbol

    disableControls(false);
});

document.addEventListener("DOMContentLoaded", () => {
    requestTimerUpdate();
});
