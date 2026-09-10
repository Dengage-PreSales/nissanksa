#!/usr/bin/env python3
"""Known input for the publish guard in tools/build-dist.py.

The guard exists to stop two publishes that look completely normal and are
not: one built on the placeholder Dengage account, where every page renders
and no event reaches Dengage, and one pointed at the shared account, where the
rows land in with another demonstration's and cannot be told apart afterwards.

Neither failure is visible on screen, so the guard is the only thing that
catches them, and a guard nobody has watched fail is not a guard.

Run:  python3 tools/test-build-dist.py
"""
import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build_dist", ROOT / "build-dist.py")
build_dist = importlib.util.module_from_spec(spec)
sys.modules["build_dist"] = build_dist
spec.loader.exec_module(build_dist)
check = build_dist.account_problems

REAL = "31"
REAL_GUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
PLACEHOLDER = ("0000", "__REPLACE_WITH_THE_NEW_APP_GUID__")

# (label, account, guid, allow_unconfigured, allow_shared, expect_refused)
CASES = [
    ("placeholder account is refused",        *PLACEHOLDER, False, False, True),
    ("placeholder passes with --unconfigured", *PLACEHOLDER, True,  False, False),
    ("placeholder guid alone is refused",     REAL, "__REPLACE_ME__", False, False, True),
    ("empty account is refused",              "",   REAL_GUID, False, False, True),
    ("shared account 28 is refused",          "28", REAL_GUID, False, False, True),
    ("shared account passes when allowed",    "28", REAL_GUID, False, True,  False),
    ("shared account is still refused under --unconfigured",
                                              "28", REAL_GUID, True,  False, True),
    ("a real account builds",                 REAL, REAL_GUID, False, False, False),
    ("missing values are refused",            None, None, True, True, True),
]


def main() -> int:
    failed = 0
    for label, account, guid, unconfigured, shared, expect_refused in CASES:
        problems = check("js/config.js", account, guid, unconfigured, shared)
        refused = bool(problems)
        if refused != expect_refused:
            failed += 1
            print(f"FAIL  {label}")
            print(f"      expected {'refusal' if expect_refused else 'a clean build'},"
                  f" got {'refusal' if refused else 'a clean build'}")
            for problem in problems:
                print(f"      {problem}")
        else:
            print(f"OK    {label}")
    print(f"\n{len(CASES) - failed}/{len(CASES)} pass")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
