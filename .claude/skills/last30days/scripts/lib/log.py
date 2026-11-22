"""Keep provider diagnostics and response details out of Tintín logs.

Source outcomes remain available in the structured research report.
"""


def is_debug() -> bool:
    return False


def debug(msg: str) -> None:
    """Skip verbose provider diagnostics in the Tintín copy."""


def source_log(prefix: str, msg: str, *, tty_only: bool = True) -> None:
    """Skip raw source diagnostics in the Tintín copy."""
