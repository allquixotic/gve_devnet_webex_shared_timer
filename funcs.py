import rich
from rich.console import Console
from rich.table import Table
from rich import print as rprint
from rich.panel import Panel
import rich.logging
from dotenv import load_dotenv
import logging
import os
import datetime

# Global variable to hold the table's state
log_table = []
load_dotenv()


class EnvironmentManager:
    """
    The EnvironmentManager class is responsible for loading and validating the necessary environment variables
    that the application relies on.

    Attributes:


    Methods:
        validate_env_variables() - Validates that all required environment variables are set,
                                   ignoring attributes related to the class internals or the os module.
    """

    MANDATORY_ENV_VARS = ['PUBLIC_URL']

    PUBLIC_URL = os.getenv('PUBLIC_URL')
    # Get the environment variable 'FLASK_ENV'. If it's not set, default to 'development'.
    FLASK_ENV = os.environ.get('FLASK_ENV', 'development').lower()  # Convert the value to lowercase
    IS_PRODUCTION = FLASK_ENV == 'production'  # Determine if the environment is production.
    LOGGER_LEVEL = os.getenv('LOGGER_LEVEL', '').upper() or 'DEBUG'

    @classmethod
    def handle_error(cls, error_message):
        """Handles errors by printing an error message and exiting the program."""
        console = Console()
        console.print(f"[bold red]Error:[/bold red] {error_message}", highlight=False)
        exit(1)

    @classmethod
    def validate_env_variables(cls):
        missing_vars = []
        console = Console()  # Instantiate a console object for rich

        table = Table(title="Environment Variables")
        table.add_column("Variable", justify="left", style="bright_white", width=30)
        table.add_column("Value", style="bright_white", width=60)

        # Update LOGGER_LEVEL if IS_PRODUCTION is True
        if cls.IS_PRODUCTION:
            cls.LOGGER_LEVEL = 'CRITICAL'

        for var_name, var_value in cls.__dict__.items():
            if "os" in var_name or "__" in var_name or isinstance(var_value, classmethod) or var_name == 'MANDATORY_ENV_VARS':
                continue
            table.add_row(var_name, str(var_value) if var_value not in [None, ""] else "Not Set")
            if var_name in cls.MANDATORY_ENV_VARS and var_value in [None, ""]:
                missing_vars.append(var_name)
        # Display the table
        console.print(table)

        if missing_vars:
            cls.handle_error(f"The following environment variables are not set: {', '.join(missing_vars)}")


class LoggerManager:
    def __init__(self):
        self.logger = self.setup()
        self.original_log_level = self.logger.level
        self.console = Console()
        self.session_logs = {}  # This will store all the logs per session

    def setup(self):
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        console_handler = rich.logging.RichHandler()
        console_handler.setFormatter(logging.Formatter(log_format))

        file_handler = logging.FileHandler("app.log", mode='a')
        file_handler.setFormatter(logging.Formatter(log_format))

        logger = logging.getLogger(__name__)
        # Determine the log level based on IS_PRODUCTION from EnvironmentManager
        if EnvironmentManager.IS_PRODUCTION:
            log_level = logging.CRITICAL  # Set logger level to CRITICAL in production
            print("IS_PRODUCTION set to TRUE. logging level set to: ", log_level)
        else:
            log_level = EnvironmentManager.LOGGER_LEVEL
            print("IS_PRODUCTION set to FALSE. logging level set to: ", log_level)

        logger.setLevel(log_level)
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

        return logger

    def log(self, message, timer_state, session_id=None):
        if session_id and session_id not in self.session_logs:
            self.session_logs[session_id] = {
                'table': Table(),
                'rows': []
            }
            # Set up the table columns only once per session
            self.setup_table_columns(self.session_logs[session_id]['table'])

        # Correcting the way we access timer_state
        session_timer_state = timer_state.get(session_id, {})

        log_entry = {
            "message": message,
            "minutes": session_timer_state.get('minutes', 0),
            "seconds": session_timer_state.get('seconds', 0),
            "state": "Running" if session_timer_state.get('running', False) else "Stopped",
            "timestamp": datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        }

        if session_id:
            self.session_logs[session_id]['rows'].append(log_entry)
            self.update_table(self.session_logs[session_id]['table'], log_entry)
            self.display_session_log(session_id)
        else:
            self.console.print(f"[{log_entry['timestamp']}] - {log_entry['message']}")

    def setup_table_columns(self, table):
        table.add_column("Message", width=30)
        table.add_column("Minutes", width=10)
        table.add_column("Seconds", width=10)
        table.add_column("State", width=10)
        table.add_column("Timestamp", width=20)

    def update_table(self, table, log_entry):
        table.add_row(log_entry['message'],
                      str(log_entry['minutes']),
                      str(log_entry['seconds']),
                      log_entry['state'],
                      log_entry['timestamp'])

    def display_session_log(self, session_id):
        if session_id in self.session_logs:
            # Clearing the console
            self.console.clear()
            self.console.print(Panel.fit(self.session_logs[session_id]['table'], title=f"[bold deep_sky_blue3]Log for Session ID: {session_id}[/bold deep_sky_blue3]"))
        else:
            self.logger.error(f"No session logs found for session_id: {session_id}")


    def exception(self, message):
        """Log an exception along with a custom message."""
        self.logger.exception(message)

    def suppress_logging(self):
        """Temporarily set logger to a higher level to suppress output."""
        self.logger.setLevel(logging.CRITICAL + 1)  # This level is higher than any standard log levels

    def restore_logging(self):
        """Restore logger to its original level."""
        self.logger.setLevel(self.original_log_level)

    def flatten_json(self, y):
        """Recursively flatten nested dictionaries."""
        out = {}

        def flatten(x, name=''):
            if type(x) is dict:
                for a in x:
                    flatten(x[a], name + a + '.')
            else:
                out[name[:-1]] = x

        flatten(y)
        return out

    def log_flattened_event_data(self, event):
        """Log individual event data in a two-column table: Key, Value."""

        # Suppress any other logging for now
        self.suppress_logging()

        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Key", width=100)
        table.add_column("Value", width=50)

        flattened_data = self.flatten_json(event)

        # Check for the access_token dictionary and handle it specially
        if "Token" in flattened_data:
            access_token_data = eval(flattened_data["Token"])  # Convert string representation back to dictionary
            for key, value in access_token_data.items():
                table.add_row("Token." + key, str(value))
            del flattened_data["Token"]  # Remove it from the flattened_data since we've handled it

        for key, value in flattened_data.items():
            table.add_row(key, str(value))

        rprint(table)

        # Restore logging level after table is printed
        self.restore_logging()
