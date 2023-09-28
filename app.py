"""
Copyright (c) 2023 Cisco and/or its affiliates.
This software is licensed to you under the terms of the Cisco Sample
Code License, Version 1.1 (the "License"). You may obtain a copy of the
License at
               https://developer.cisco.com/docs/licenses
All use of the material herein must be in accordance with the terms of
the License. All rights not expressly granted by the License are
reserved. Unless required by applicable law or agreed to separately in
writing, software distributed under the License is distributed on an "AS
IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied.
"""

from flask import Flask, render_template, request
from apscheduler.schedulers.background import BackgroundScheduler
from flask_cors import CORS
from flask_socketio import SocketIO
from funcs import LoggerManager, EnvironmentManager
from datetime import datetime
from threading import Lock, Event

logger_manager = LoggerManager()
EnvironmentManager.validate_env_variables()

thread = None
thread_lock = Lock()

timer_state = {}
previous_timer_state = {}
stop_events = {}  # Store stop events indexed by session_id
lock_state = {}

stop_event = Event()

app = Flask(__name__)

CORS(app, origins=["http://127.0.0.1:9001"])
socketio = SocketIO(app, cors_allowed_origins="*")

scheduler = BackgroundScheduler()
scheduler.start()


def background_thread(session_id):
    global timer_state
    logger_manager.logger.info(f'Starting background thread (timer) for session: {session_id}: {timer_state[session_id]}')

    # Initialize timer state for this session if it doesn't already exist
    if session_id not in timer_state:
        timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}

    # Initialize stop_event for this session if it doesn't already exist
    if session_id not in stop_events:
        stop_events[session_id] = Event()

    while not stop_events[session_id].is_set():  # Check the stop_event to decide whether to exit or continue
        socketio.sleep(1)

        if not timer_state[session_id]['running']:  # Exit early if the timer isn't running
            return

        # Adjust the timer
        if timer_state[session_id]['seconds'] > 0:
            timer_state[session_id]['seconds'] -= 1
        elif timer_state[session_id]['minutes'] > 0:
            timer_state[session_id]['minutes'] -= 1
            timer_state[session_id]['seconds'] = 59
        else:
            stop_events[session_id].set()  # Set the stop_event to stop the background_thread for this session
            timer_state[session_id]['running'] = False
            logger_manager.log("Timer Stopped", timer_state, session_id=session_id)

        # Emit the updated timer state for this session
        socketio.emit('timer_update', {session_id: timer_state[session_id]})
        logger_manager.logger.info(f'Emitted timer_update event with session id: {session_id}: {timer_state[session_id]}')


@app.route('/')
def index():
    return render_template('index.html', PUBLIC_URL=EnvironmentManager.PUBLIC_URL)


@app.route('/timer')
def timer():
    return render_template('timer.html')


@socketio.on('connect')
def handle_connect():
    sid = request.sid
    logger_manager.logger.info('Client connected: %s', sid)


@socketio.on('session_init')
def handle_session_init(data):
    session_id = data.get('sessionId')
    logger_manager.logger.info('Received session id: %s', session_id)


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    logger_manager.logger.info('Client connected: %s', sid)


@socketio.on('get_timer')
def handle_get_timer_event(data):
    session_id = data.get('sessionId')
    if session_id not in timer_state:
        timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}  # Initialize if not already present
    socketio.emit('timer_update', {session_id: timer_state[session_id]})
    print(f"DEBUG: timer_state before log: {timer_state}")
    logger_manager.log("Starting new timer session", timer_state, session_id=session_id)
    logger_manager.logger.info(f'Handling get_timer event with session ID: {session_id}: {timer_state[session_id]}')


@socketio.on('start_timer')
def handle_start_timer_event(data):
    global thread, stop_event, timer_state, previous_timer_state
    logger_manager.logger.info('Received start_timer event')
    session_id = data.get('sessionId')
    logger_manager.logger.info(f'Received start_timer event with session id: {session_id}: {timer_state[session_id]} at {datetime.now()}')
    previous_timer_state[session_id] = dict(timer_state[session_id])
    timer_state[session_id]['running'] = True  # Update the 'running' attribute to True
    stop_event.clear()  # Clear the stop_event flag
    socketio.start_background_task(background_thread, session_id)  # Start the background_thread
    socketio.emit('timer_update', {session_id: timer_state[session_id]})
    logger_manager.log("Timer Started", timer_state, session_id=session_id)
    logger_manager.logger.info(f'Sent timer_update event with session id: {session_id}: {timer_state[session_id]} at {datetime.now()}')


@socketio.on('stop_timer')
def handle_stop_timer_event(data):
    global thread, stop_event, timer_state, previous_timer_state
    session_id = data.get('sessionId')
    logger_manager.logger.info(f'Received stop_timer event with session id: {session_id}: {timer_state[session_id]} at {datetime.now()}')
    timer_state[session_id]['running'] = False
    stop_event.set()  # Set stop event flag
    socketio.emit('timer_update', {session_id: timer_state[session_id]})
    logger_manager.log("Timer Stopped", timer_state, session_id=session_id)
    logger_manager.logger.info(f'Sent timer_update event to stop timer with session id:{session_id}: {timer_state[session_id]} at {datetime.now()}')


@socketio.on('reset_timer')
def handle_reset_timer_event(data):
    global timer_state, previous_timer_state
    session_id = data.get('sessionId')
    if session_id not in previous_timer_state or session_id not in timer_state:
        # Here's one way you could handle a missing session_id:
        timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    else:
        timer_state[session_id] = dict(previous_timer_state[session_id])
    timer_state[session_id]['running'] = False
    socketio.emit('timer_update', {session_id: timer_state[session_id]})
    logger_manager.log("Timer Reset", timer_state, session_id=session_id)


@socketio.on('clear_timer')
def handle_clear_timer_event(data):
    global timer_state
    session_id = data.get('sessionId')
    timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    logger_manager.logger.info(f"Clearing timer for: {session_id}: {timer_state[session_id]}")
    socketio.emit('timer_update', {session_id: timer_state[session_id]})
    logger_manager.log("Timer Cleared", timer_state, session_id=session_id)


@socketio.on('set_timer')
def handle_set_timer_event(data):
    global timer_state, previous_timer_state
    session_id = data.get('sessionId')

    # Initialize timer_state and previous_timer_state for the session_id if not already present
    if session_id not in timer_state:
        timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    if session_id not in previous_timer_state:
        previous_timer_state[session_id] = dict(timer_state[session_id])

    unit = data.get('unit')
    value = int(data.get('value', 0))

    # Save current state to previous_timer_state before updating timer_state
    previous_timer_state[session_id] = dict(timer_state[session_id])

    if unit == 'minutes':
        timer_state[session_id]['minutes'] = value
    elif unit == 'seconds':
        timer_state[session_id]['seconds'] = value
    socketio.emit('timer_update', {session_id: timer_state[session_id]})
    logger_manager.log("Timer Set", timer_state, session_id=session_id)
    logger_manager.logger.info(f'Timer set: {session_id}: {timer_state[session_id]}')


@socketio.on('increment_timer')
def handle_increment_timer_event(data):
    session_id = data.get('sessionId')
    if session_id not in timer_state:
        logger_manager.logger.error(f'Session {session_id} not found in timer_state')
        return  # Exit early if the session_id isn't found

    unit = data.get('unit')
    if unit == 'minutes':
        timer_state[session_id]['minutes'] += 1
        if timer_state[session_id]['minutes'] > 99:
            timer_state[session_id]['minutes'] = 0
    elif unit == 'seconds':
        timer_state[session_id]['seconds'] += 1
        if timer_state[session_id]['seconds'] >= 60:
            timer_state[session_id]['minutes'] += 1
            timer_state[session_id]['seconds'] = 0
            if timer_state[session_id]['minutes'] > 99:
                timer_state[session_id]['minutes'] = 0
    socketio.emit('timer_update', {session_id: timer_state[session_id]})
    logger_manager.log("Timer Incremented", timer_state, session_id=session_id)
    logger_manager.logger.info(f"Incrementing timer for session {session_id}: {timer_state[session_id]}")


@socketio.on('decrement_timer')
def handle_decrement_timer_event(data):
    session_id = data.get('sessionId')
    if session_id not in timer_state:
        logger_manager.logger.error(f'Session {session_id} not found in timer_state')
        return  # Exit early if the session_id isn't found

    unit = data.get('unit')
    if unit == 'minutes':
        timer_state[session_id]['minutes'] -= 1
        if timer_state[session_id]['minutes'] < 0:
            timer_state[session_id]['minutes'] = 99
    elif unit == 'seconds':
        timer_state[session_id]['seconds'] -= 1
        if timer_state[session_id]['seconds'] < 0:
            timer_state[session_id]['minutes'] -= 1
            timer_state[session_id]['seconds'] = 59
            if timer_state[session_id]['minutes'] < 0:
                timer_state[session_id]['minutes'] = 99
    socketio.emit('timer_update', {session_id: timer_state[session_id]})
    logger_manager.log("Timer Decremented", timer_state, session_id=session_id)
    logger_manager.logger.info(f"Decrementing timer for session {session_id}: {timer_state[session_id]}")


@socketio.on('toggle_lock')
def handle_lock_event(data):
    session_id = data.get('sessionId')
    print(f"Received toggle_lock event for session {session_id}: {data}")

    if session_id not in lock_state:
        lock_state[session_id] = {'locked': False, 'lockerID': None}

    if data.get('locked', False):
        lock_state[session_id]['locked'] = True
        lock_state[session_id]['lockerID'] = request.sid
        socketio.emit('lock', {'lockerID': request.sid, 'sessionId': session_id})
        logger_manager.log("Timer Locked", timer_state, session_id=session_id)

    else:
        lock_state[session_id]['locked'] = False
        lock_state[session_id]['lockerID'] = None
        socketio.emit('unlock', {'lockerID': request.sid, 'sessionId': session_id})
        logger_manager.log("Timer Unlocked", timer_state, session_id=session_id)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=9001, debug=True)
