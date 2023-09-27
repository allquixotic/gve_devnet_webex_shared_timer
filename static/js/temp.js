function adjustTime(unit, direction) {
    let endpoint = direction === 'up' ? '/timer/increment/' : '/timer/decrement/';
    fetch(endpoint + unit, { method: 'POST' })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('minutes').value = data.minutes.toString().padStart(2, '0');
            document.getElementById('seconds').value = data.seconds.toString().padStart(2, '0');

            // Update the timer immediately
            updateTimerDisplay();
        }
    })
    .catch(error => {
        console.log('There was a problem with the fetch operation:', error.message);
    });
}
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

            // Update the timer immediately
            updateTimerDisplay();
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

            // Update the timer immediately
            updateTimerDisplay();
        }
    });
}
function closeApp() {
    document.body.style.display = 'none';
}



// more functionalities to come
