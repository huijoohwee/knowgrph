from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))

from lib.game_flight_sim_smoke_ledger import BrowserVerificationLedger


class BrowserVerificationLedgerTest(unittest.TestCase):
    def test_reports_all_independent_failures_and_names_skipped_dependents(
        self,
    ) -> None:
        ledger = BrowserVerificationLedger()
        dependent_called = False

        def fail_source() -> None:
            raise AssertionError("injected Source Files failure")

        def fail_network() -> None:
            raise AssertionError("injected request-fence failure")

        def dependent() -> None:
            nonlocal dependent_called
            dependent_called = True

        ledger.verify("Source Files apply", fail_source)
        ledger.verify("zero-network fence", fail_network)
        ledger.verify(
            "retained authored XR Canvas",
            dependent,
            depends_on=("Source Files apply",),
        )

        with self.assertRaises(AssertionError) as raised:
            ledger.assert_success()
        message = str(raised.exception)
        self.assertIn("FAILED Source Files apply", message)
        self.assertIn("FAILED zero-network fence", message)
        self.assertIn("SKIPPED retained authored XR Canvas", message)
        self.assertFalse(dependent_called)
        self.assertEqual(
            [record["status"] for record in ledger.evidence()],
            ["failed", "failed", "skipped"],
        )


if __name__ == "__main__":
    unittest.main()
