from typing import Optional
from flask import Flask, render_template, request
from flask_socketio import SocketIO
from threading import Event
import flask_socketio as fs

class AppState:
    instance = None

    def __new__(cls):
        if cls.instance is None:
            cls.instance = super(AppState, cls).__new__(cls)
            cls.instance.timer_state = {}
            cls.instance.previous_timer_state = {}
            cls.instance.stop_events = {}
            cls.instance.lock_state = {}
            cls.instance.session_clients = {}
        return cls.instance

state = AppState()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True, )

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/timer')
def timer():
    return render_template('timer.html')

@socketio.on('connect')
def handle_connect(auth):
    sid = request.sid
    if auth is not None and 'sessionId' in auth:
        session_id = auth['sessionId']
        if session_id is None or session_id == "null":
            print(f"WARN: Client {sid} connected with invalid session")
            return
        fs.join_room(session_id)
        if session_id in state.session_clients:
            state.session_clients[session_id].add(sid)
        else:
            state.session_clients[session_id] = set()
            state.session_clients[session_id].add(sid)
        if session_id in state.lock_state:
            lock_info = state.lock_state[session_id]
            if lock_info['locked']:
                socketio.emit('lock', {'sessionId': session_id}, to=sid)
            else:
                socketio.emit('unlock', {'sessionId': session_id}, to=sid)
        print(f"INFO: Client {sid} connected with session {session_id}")
    else:
        print(f"WARN: Client {sid} connected without session. auth={auth}")

def get_session_id() -> Optional[str]:
    p = [x for x in fs.rooms() if x != request.sid]
    return p[0] if len(p) == 1 else None

def emit_timer_update(session_id, target):
    locked = state.lock_state[session_id]['locked'] if session_id in state.lock_state else False
    if session_id == target:
        for csid in state.session_clients[session_id]:
            locked_for_me = locked == False or csid in state.lock_state[session_id]['authorized_sids']
            socketio.emit('timer_update', {session_id: state.timer_state[session_id], 'locked': locked, 'lockedForMe': locked_for_me}, to=csid)
    else:
        locked_for_me = locked == False or target in state.lock_state[session_id]['authorized_sids']
        socketio.emit('timer_update', {session_id: state.timer_state[session_id], 'locked': locked, 'lockedForMe': locked_for_me}, to=target)
    
@socketio.on('disconnect')
def handle_disconnect():
    session_id = get_session_id()
    if session_id is None:
        #No session ID, nothing to do
        return
    for session_id in fs.rooms():
        fs.leave_room(session_id)
        if session_id in state.session_clients:
            state.session_clients[session_id].discard(request.sid)
        if session_id not in state.session_clients:
            #Delete the state in timer_state, previous_timer_state, and lock_state for this session_id
            if session_id in state.timer_state:
                del state.timer_state[session_id]
            if session_id in state.previous_timer_state:
                del state.previous_timer_state[session_id]
            if session_id in state.lock_state:
                del state.lock_state[session_id]

def background_thread(session_id):
    if session_id not in state.timer_state:
        state.timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    if session_id not in state.stop_events:
        state.stop_events[session_id] = Event()
    while not state.stop_events[session_id].is_set():
        socketio.sleep(60)
        if not state.timer_state[session_id]['running']:
            return
        if state.timer_state[session_id]['minutes'] > 0 or state.timer_state[session_id]['seconds'] > 0:
            state.timer_state[session_id]['seconds'] -= 60
            while state.timer_state[session_id]['seconds'] < 0:
                state.timer_state[session_id]['minutes'] -= 1
                state.timer_state[session_id]['seconds'] += 60
            if state.timer_state[session_id]['minutes'] < 0:
                state.timer_state[session_id]['minutes'] = 0
            if state.timer_state[session_id]['minutes'] > 0 or state.timer_state[session_id]['seconds'] > 0:
                emit_timer_update(session_id, session_id)
        else:
            state.stop_events[session_id].set()
            state.timer_state[session_id]['running'] = False

@socketio.on('start_timer')
def handle_start_timer_event(data):
    session_id = get_session_id()
    if not has_permission(session_id, request.sid):
        return
    state.previous_timer_state[session_id] = dict(state.timer_state[session_id])
    if session_id not in state.timer_state:
        state.timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    if session_id not in state.stop_events:
        state.stop_events[session_id] = Event()
    state.timer_state[session_id]['running'] = True
    state.stop_events[session_id].clear()
    socketio.start_background_task(background_thread, session_id)
    emit_timer_update(session_id, session_id)

@socketio.on('stop_timer')
def handle_stop_timer_event(data):
    session_id = get_session_id()
    if not has_permission(session_id, request.sid):
        return
    state.timer_state[session_id]['running'] = False
    state.stop_events[session_id].set()
    emit_timer_update(session_id, session_id)

@socketio.on('reset_timer')
def handle_reset_timer_event(data):
    session_id = get_session_id()
    if not has_permission(session_id, request.sid):
        return
    state.timer_state[session_id] = dict(state.previous_timer_state.get(session_id, {'minutes': 0, 'seconds': 0, 'running': False}))
    state.timer_state[session_id]['running'] = False
    emit_timer_update(session_id, session_id)

@socketio.on('clear_timer')
def handle_clear_timer_event(data):
    session_id = get_session_id()
    if not has_permission(session_id, request.sid):
        return
    state.timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    state.stop_events[session_id] = Event()
    state.stop_events[session_id].set()
    emit_timer_update(session_id, session_id)

@socketio.on('set_timer')
def handle_set_timer_event(data):
    session_id = get_session_id()
    if not has_permission(session_id, request.sid):
        return
    if session_id not in state.timer_state:
        state.timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    state.previous_timer_state[session_id] = dict(state.timer_state[session_id])
    unit = data.get('unit')
    value = int(data.get('value', 0))
    if unit == 'minutes':
        state.timer_state[session_id]['minutes'] = value
    elif unit == 'seconds':
        state.timer_state[session_id]['seconds'] = value
    emit_timer_update(session_id, session_id)

@socketio.on('get_timer')
def handle_get_timer_event(data):
    session_id = get_session_id()
    if session_id in state.timer_state:
        emit_timer_update(session_id, request.sid)
        

@socketio.on('increment_timer')
def handle_increment_timer_event(data):
    session_id = get_session_id()
    if has_permission(session_id, request.sid) == False:
        return
    if session_id not in state.timer_state:
        state.timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    unit = data.get('unit')
    if unit == 'minutes':
        state.timer_state[session_id]['minutes'] += 1
        if state.timer_state[session_id]['minutes'] > 99:
            state.timer_state[session_id]['minutes'] = 0
    elif unit == 'seconds':
        state.timer_state[session_id]['seconds'] += 1
        if state.timer_state[session_id]['seconds'] >= 60:
            state.timer_state[session_id]['minutes'] += 1
            state.timer_state[session_id]['seconds'] = 0
            if state.timer_state[session_id]['minutes'] > 99:
                state.timer_state[session_id]['minutes'] = 0
    emit_timer_update(session_id, session_id)

@socketio.on('decrement_timer')
def handle_decrement_timer_event(data):
    session_id = get_session_id()
    if not has_permission(session_id, request.sid):
        return
    if session_id not in state.timer_state:
        state.timer_state[session_id] = {'minutes': 0, 'seconds': 0, 'running': False}
    unit = data.get('unit')
    if unit == 'minutes':
        state.timer_state[session_id]['minutes'] -= 1
        if state.timer_state[session_id]['minutes'] < 0:
            state.timer_state[session_id]['minutes'] = 99
    elif unit == 'seconds':
        state.timer_state[session_id]['seconds'] -= 1
        if state.timer_state[session_id]['seconds'] < 0:
            state.timer_state[session_id]['minutes'] -= 1
            state.timer_state[session_id]['seconds'] = 59
            if state.timer_state[session_id]['minutes'] < 0:
                state.timer_state[session_id]['minutes'] = 99
    emit_timer_update(session_id, session_id)

def has_permission(session_id, sid):
    if session_id not in state.lock_state:
        return True
    lock_info = state.lock_state[session_id]
    if lock_info['locked'] and lock_info['authorized_sids'] is not None and sid not in lock_info['authorized_sids']:
        print(f"Client {request.sid} does not have permission to mutate timer for session {session_id}!")
        return False
    return True

@socketio.on('toggle_lock')
def handle_lock_event(data):
    session_id = get_session_id()
    pin: Optional[str] = data.get('pin', None)
    pin = pin.strip() if pin is not None else None
    # If locking, just set the lock. If unlocking, check the PIN.
    if (session_id not in state.lock_state or state.lock_state[session_id]['locked'] == False) and pin is not None and pin.isnumeric() and len(pin) >= 6:
        #Unlocked; we are going to claim the lock
        state.lock_state[session_id] = {'locked': True, 'pin': pin, 'authorized_sids': set([request.sid])}
        #Tell everyone except our locking client that it's now locked
        for csid in [x for x in state.session_clients[session_id] if x != request.sid]:
            socketio.emit('lock', {'sessionId': session_id}, to=csid)
    elif state.lock_state[session_id]['locked'] == True and pin is not None and pin == state.lock_state[session_id]['pin']:
        #Locked; we are going to unlock it
        unlockFor = data.get('unlockFor', 'me')
        if unlockFor == 'me':
            state.lock_state[session_id]['authorized_sids'].add(request.sid)
            emit_timer_update(session_id, request.sid)
        elif unlockFor == 'all':
            state.lock_state[session_id] = {'locked': False, 'pin': None, 'authorized_sids': None}
            emit_timer_update(session_id, session_id)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=9001, debug=False)
