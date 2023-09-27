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

# Timer's state
timer_state = {
    'minutes': 0,
    'seconds': 0,
    'running': False
}

# Previous timer's state (to support the Reset functionality)
previous_timer_state = {
    'minutes': 0,
    'seconds': 0
}
is_timer_running = False
stop_event = Event()

app = Flask(__name__)

CORS(app, origins=["http://127.0.0.1:9001"])
socketio = SocketIO(app, cors_allowed_origins="*")

scheduler = BackgroundScheduler()
scheduler.start()


def background_thread():
    global timer_state
    logger_manager.logger.info('Starting background thread (timer)')
    while not stop_event.is_set():  # Check the stop_event to decide whether to exit or continue
        socketio.sleep(1)

        if not is_timer_running:  # Exit early if the timer isn't running
            return

        if timer_state['seconds'] > 0:
            timer_state['seconds'] -= 1
        elif timer_state['minutes'] > 0:
            timer_state['minutes'] -= 1
            timer_state['seconds'] = 59
        else:
            stop_event.set()  # Set the stop_event to stop the background_thread
            timer_state['running'] = False

        socketio.emit('timer_update', timer_state)
        logger_manager.logger.info(f'Emitted timer_update event with data: {timer_state}')


@app.route('/')
def index():
    return render_template('index.html', PUBLIC_URL=EnvironmentManager.PUBLIC_URL)


@app.route('/timer')
def timer():
    return render_template('timer.html')


@socketio.on('connect')
def handle_connect():
    sid = request.sid
    # join_room(sid)
    logger_manager.logger.info('Client connected: %s', sid)


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    logger_manager.logger.info('Client connected: %s', sid)


@socketio.on('get_timer')
def handle_get_timer_event():
    global timer_state
    socketio.emit('timer_update', timer_state)
    logger_manager.logger.info('Handling get_timer event.')


@socketio.on('start_timer')
def handle_start_timer_event():
    global thread, is_timer_running, stop_event
    logger_manager.logger.info('Received start_timer event')
    global timer_state, previous_timer_state
    previous_timer_state = dict(timer_state)
    timer_state['running'] = True  # Update the 'running' attribute to True
    is_timer_running=True
    stop_event.clear()  # Clear the stop_event flag
    socketio.start_background_task(background_thread)  # Start the background_thread
    socketio.emit('timer_update', timer_state)
    logger_manager.logger.info('Sent timer_update event with data: %s', timer_state)


@socketio.on('stop_timer')
def handle_stop_timer_event():
    logger_manager.logger.info('Received stop_timer event at {}'.format(datetime.now()))
    global timer_state, is_timer_running, stop_event
    timer_state['running'] = False
    is_timer_running = False
    stop_event.set()    # Set stop event flag
    socketio.emit('timer_update', timer_state)
    logger_manager.logger.info('Sent timer_update event to STOP timer with data: %s at %s', timer_state, datetime.now())


@socketio.on('reset_timer')
def handle_reset_timer_event():
    global timer_state
    timer_state = dict(previous_timer_state)
    timer_state['running'] = False
    socketio.emit('timer_update', timer_state)


@socketio.on('clear_timer')
def handle_clear_timer_event():
    global timer_state
    timer_state = {'minutes': 0, 'seconds': 0, 'running': False}
    socketio.emit('timer_update', timer_state)


@socketio.on('set_timer')
def handle_set_timer_event(data):
    global timer_state, previous_timer_state
    unit = data.get('unit')
    value = int(data.get('value', 0))

    if unit == 'minutes':
        timer_state['minutes'] = value
    elif unit == 'seconds':
        timer_state['seconds'] = value
    previous_timer_state = dict(timer_state)
    socketio.emit('timer_update', timer_state)


@socketio.on('increment_timer')
def handle_increment_timer_event(data):
    global timer_state
    logger_manager.logger.info("Incrementing timer")
    unit = data.get('unit')
    if unit == 'minutes':
        timer_state['minutes'] += 1
        if timer_state['minutes'] > 99:
            timer_state['minutes'] = 0
    elif unit == 'seconds':
        timer_state['seconds'] += 1
        if timer_state['seconds'] >= 60:
            timer_state['minutes'] += 1
            timer_state['seconds'] = 0
            if timer_state['minutes'] > 99:
                timer_state['minutes'] = 0
    socketio.emit('timer_update', timer_state)


@socketio.on('decrement_timer')
def handle_decrement_timer_event(data):
    global timer_state
    logger_manager.logger.info("Decrementing timer")
    unit = data.get('unit')
    if unit == 'minutes':
        timer_state['minutes'] -= 1
        if timer_state['minutes'] < 0:
            timer_state['minutes'] = 99
    elif unit == 'seconds':
        timer_state['seconds'] -= 1
        if timer_state['seconds'] < 0:
            timer_state['minutes'] -= 1
            timer_state['seconds'] = 59
            if timer_state['minutes'] < 0:
                timer_state['minutes'] = 99
    socketio.emit('timer_update', timer_state)


@socketio.on('toggle_lock')
def handle_lock_event(data):
    print("Received toggle_lock event:", data)
    if data.get('locked', False):
        socketio.emit('lock', {'lockerID': request.sid})
    else:
        socketio.emit('unlock', {'lockerID': request.sid})


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=9001, debug=True)
