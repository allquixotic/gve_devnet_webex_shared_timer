// Create a new Webex app instance
/*
// This was included at the top of shared.js in example?
var app = new window.Webex.Application();

Also this will change color of app based on theme.
// Wait for onReady promise, handle error scenario
app.onReady().then(() => {
    log("Application ready. App", app);
    app.context.getUser().then((user)=> {
        log("User ID", user.id)
    }).catch((errorcode) => {
        log("Error: ", Webex.Application.ErrorCodes[errorcode]);
    })
    // Register event handler for themeChanged event:
    app.on('application:themeChanged', (theme) => {
        updateColorTheme(theme);
        log("Updating theme to", theme)
    })
    // Set app theme to match selected theme on load:
    updateColorTheme(app.theme)
})

// Change color scheme

function updateColorTheme(theme) {
    switch (theme) {
        case "LIGHT":
            document.body.style["background"] = "#FFFFFF";
            document.body.style["color"] = "#000000";
            break;
        case "DARK":
            document.body.style["background"] = "#121212";
            document.body.style["color"] = "#F7F7F7";
            break;
        default:
            break;
    }
}
*/



let socket = io.connect('http://' + document.domain + ':' + location.port);

// Listen for real-time timer updates
socket.on('timer_update', function(data) {
    document.getElementById('minutes').value = data.minutes.toString().padStart(2, '0');
    document.getElementById('seconds').value = data.seconds.toString().padStart(2, '0');
    updateTimerDisplay(data.minutes, data.seconds);
});


function updateTimerDisplay() {
    fetch('/timer/get', { method: 'GET' })
    .then(response => response.json())
    .then(data => {
        document.getElementById('minutes').value = data.minutes.toString().padStart(2, '0');
        document.getElementById('seconds').value = data.seconds.toString().padStart(2, '0');

        if (data.minutes === 0 && data.seconds === 0) {
            // If the timer has hit zero, change the button back to the green play button.
            document.getElementById('playPauseImg').src = "/static/IMAGES/play-icon.png";
            document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
            clearInterval(timerInterval); // Also clear the timer update interval
        }
    });
}

let arrowButtonsEnabled = true; // Add this flag

function adjustTime(unit, direction) {
    if (arrowButtonsEnabled) { // Check if arrow buttons are enabled

        let endpoint = direction === 'up' ? '/timer/increment/' : '/timer/decrement/';
        fetch(endpoint + unit, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                document.getElementById('minutes').value = data.minutes.toString().padStart(2, '0');
                document.getElementById('seconds').value = data.seconds.toString().padStart(2, '0');
            }
        })
        .catch(error => {
            console.log('There was a problem with the fetch operation:', error.message);
        });
    }
}



function startTimer() {
    fetch('/timer/start', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            console.log(data.message);
            // Update the timer immediately
            updateTimerDisplay();
            // Set an interval to update the timer display every second
            timerInterval = setInterval(updateTimerDisplay, 1000);
        }
    });
}

function stopTimer() {
    // Clear the interval when the timer is stopped
    clearInterval(timerInterval);
    fetch('/timer/stop', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            console.log(data.message);
        }
    });
}

function toggleTimer() {
    let isRunning = document.getElementById('playPauseBtn').getAttribute('data-running') === 'true';
    if (isRunning) {
        stopTimer();
        document.getElementById('playPauseImg').src = "/static/IMAGES/play-icon.png";
        document.getElementById('playPauseBtn').setAttribute('data-running', 'false');
    } else {
        startTimer();
        document.getElementById('playPauseImg').src = "/static/IMAGES/pause_icon.png";
        document.getElementById('playPauseBtn').setAttribute('data-running', 'true');
    }
}

function resetTimer() {
    fetch('/timer/reset', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            console.log(data.message);
            // Setting the timer display back to returned data's time (or zero if not provided)
            document.getElementById('minutes').value = data.minutes ? data.minutes.toString().padStart(2, '0') : '00';
            document.getElementById('seconds').value = data.seconds ? data.seconds.toString().padStart(2, '0') : '00';
        }
    });
}

function clearbutton() {
    fetch('/timer/clear', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            console.log(data.message);
            // Resetting the timer to default state (assuming it's like a reset)
            document.getElementById('minutes').value = '00';
            document.getElementById('seconds').value = '00';
        }
    });
}

let isLocked = false;
let lockerID = null;

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

    document.getElementById("lockSymbol").innerHTML = disabled ? "&#128274;" : "&#128275;"; // This line was flipped
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
function handleInputKeyup(event, unit) {
    if (event.key === 'Enter') {
        const inputValue = parseInt(event.target.value, 10);
        if (!isNaN(inputValue)) {
            // Ensure the input value is within a valid range (0-59 for minutes and seconds)
            const newValue = Math.min(Math.max(inputValue, 0), unit === 'minutes' ? 99 : 99);

            // Update the input field with the formatted value
            event.target.value = newValue.toString().padStart(2, '0');

            // Update the timer using the adjusted value
            fetch('/timer/set/' + unit + '/' + newValue, { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Optionally, update the timer display or perform any other necessary actions
                        updateTimerDisplay();
                    }
                })
                .catch(error => {
                    console.log('There was a problem with the fetch operation:', error.message);
                });
        }
    }
}
