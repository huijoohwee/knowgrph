from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any


class BrowserVerificationLedger:
    def __init__(self) -> None:
        self._records: dict[str, dict[str, Any]] = {}

    def verify(
        self,
        name: str,
        check: Callable[[], Any],
        *,
        depends_on: Iterable[str] = (),
    ) -> Any | None:
        if name in self._records:
            raise ValueError(f"duplicate browser verification name: {name}")
        dependencies = tuple(depends_on)
        unknown = [
            dependency
            for dependency in dependencies
            if dependency not in self._records
        ]
        if unknown:
            raise ValueError(
                f"{name} names unknown dependencies: {', '.join(unknown)}"
            )
        blocked = [
            dependency
            for dependency in dependencies
            if self._records[dependency]["status"] != "passed"
        ]
        if blocked:
            self._records[name] = {
                "name": name,
                "status": "skipped",
                "blockedBy": blocked,
            }
            return None
        try:
            value = check()
        except Exception as error:
            self._records[name] = {
                "name": name,
                "status": "failed",
                "errorType": type(error).__name__,
                "message": str(error),
            }
            return None
        self._records[name] = {"name": name, "status": "passed"}
        return value

    def evidence(self) -> list[dict[str, Any]]:
        return [dict(record) for record in self._records.values()]

    def assert_success(self) -> None:
        failed = [
            record
            for record in self._records.values()
            if record["status"] == "failed"
        ]
        skipped = [
            record
            for record in self._records.values()
            if record["status"] == "skipped"
        ]
        if not failed and not skipped:
            return
        lines = ["Flight browser named verifications did not all pass:"]
        lines.extend(
            f"FAILED {record['name']}: {record['message']}"
            for record in failed
        )
        lines.extend(
            f"SKIPPED {record['name']}: blocked by "
            f"{', '.join(record['blockedBy'])}"
            for record in skipped
        )
        raise AssertionError("\n".join(lines))
