from __future__ import annotations

import unittest
from typing import Any

from playwright.sync_api import Error as PlaywrightError

from verify_game_mode_xr_share_browser_smoke import poll_evaluate


class FakePage:
    def __init__(self, outcomes: list[Any]) -> None:
        self.outcomes = outcomes
        self.evaluate_count = 0
        self.load_states: list[str] = []

    def evaluate(self, _script: str) -> Any:
        self.evaluate_count += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    def wait_for_load_state(self, state: str) -> None:
        self.load_states.append(state)

    def wait_for_timeout(self, _interval_ms: int) -> None:
        pass


class PollEvaluateTest(unittest.TestCase):
    def test_retries_navigation_context_loss_after_dom_content_loaded(self) -> None:
        page = FakePage(
            [
                PlaywrightError(
                    "Page.evaluate: Execution context was destroyed, most likely because of a navigation"
                ),
                {"ready": True},
            ]
        )

        result = poll_evaluate(page, "() => true", lambda value: value == {"ready": True})

        self.assertEqual(result, {"ready": True})
        self.assertEqual(page.evaluate_count, 2)
        self.assertEqual(page.load_states, ["domcontentloaded"])

    def test_propagates_unqualified_context_loss(self) -> None:
        error = PlaywrightError("Page.evaluate: Execution context was destroyed")
        page = FakePage([error])

        with self.assertRaises(PlaywrightError) as raised:
            poll_evaluate(page, "() => true", lambda _value: True)

        self.assertIs(raised.exception, error)
        self.assertEqual(page.load_states, [])


if __name__ == "__main__":
    unittest.main()
