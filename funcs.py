import rich
from rich.console import Console
from rich.table import Table
from rich import print as rprint
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

    PUBLIC_URL = os.getenv('PUBLIC_URL')

    @classmethod
    def validate_env_variables(cls):
        missing_vars = []
        console = Console()  # Instantiate a console object for rich

        table = Table(title="Environment Variables")
        table.add_column("Variable", justify="left", style="bright_white", width=30)
        table.add_column("Value", style="bright_white", width=60)

        for var_name, var_value in cls.__dict__.items():
            if "os" in var_name or "__" in var_name or isinstance(var_value, classmethod):  # ignore class documentation & methods
                continue
            table.add_row(var_name, str(var_value) if var_value is not None else "Not Set")
            if var_value in ("", None):
                missing_vars.append(var_name)

        # Display the table
        console.print(table)

        if missing_vars:
            raise EnvironmentError(f"The following environment variables are not set: {', '.join(missing_vars)}")


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
        # logger.setLevel(logging.INFO)  # default log level
        logger.setLevel(logging.ERROR)  # supress logs
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
        table.add_column("Timestamp", width=20, style="dim")

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
            # Printing the session ID in bright blue above the table
            self.console.print(f"Session ID: [bold blue]{session_id}[/bold blue]")
            # Print the existing table for the session ID
            self.console.print(self.session_logs[session_id]['table'])
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

