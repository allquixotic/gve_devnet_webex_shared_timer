import rich
from rich.console import Console
from rich.table import Table
from rich import print as rprint
import rich.logging
from dotenv import load_dotenv
import logging
import os

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

    def setup(self):
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        console_handler = rich.logging.RichHandler()
        console_handler.setFormatter(logging.Formatter(log_format))

        file_handler = logging.FileHandler("app.log", mode='a')
        file_handler.setFormatter(logging.Formatter(log_format))

        logger = logging.getLogger(__name__)
        logger.setLevel(logging.INFO)  # default log level
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

        return logger

    def log(self, message, level=logging.INFO):
        if level == logging.DEBUG:
            self.logger.debug(message)
        elif level == logging.INFO:
            self.logger.info(message)
        elif level == logging.WARNING:
            self.logger.warning(message)
        elif level == logging.ERROR:
            self.logger.error(message)
        elif level == logging.CRITICAL:
            self.logger.critical(message)
        else:
            self.logger.info(message)

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
