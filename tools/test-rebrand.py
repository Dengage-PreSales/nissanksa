#!/usr/bin/env python3
"""Known input for the rebrand pass in tools/build-pages.py.

The pass rewrites captured copy, so a mistake in it is invisible in a diff and
lands on every page. Two real defects were caught here rather than on screen: a
regex escape that made the pattern match nothing at all, so every page silently
kept the old brand, and a matcher that returned the trailing word twice, so
"Nissan Patrol" came out as "Nissan Patrol Patrol".

Run:  python3 tools/test-rebrand.py
"""
import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build_pages", ROOT / "build-pages.py")
build_pages = importlib.util.module_from_spec(spec)
sys.modules["build_pages"] = build_pages
spec.loader.exec_module(build_pages)
rebrand_text = build_pages._rebrand_text

# The marque standing for the owner of the website. All of these must change:
# on a storefront branded D-AUTO they would have the demo claiming to be
# Nissan's own site.
OWNER = [
    ("Why Nissan?", "Why D-AUTO?"),
    ("FIND A NISSAN CENTER", "FIND A D-AUTO CENTER"),
    ("Careers at Nissan", "Careers at D-AUTO"),
    ("© Nissan 2026", "© D-AUTO 2026"),
    ("Nissan Social", "D-AUTO Social"),
    ("The latest offers from Nissan.", "The latest offers from D-AUTO."),
    ("Nissan Saudi Arabia", "D-AUTO"),
    ("I'D LIKE TO RECEIVE MARKETING COMMUNICATION FROM NISSAN",
     "I'D LIKE TO RECEIVE MARKETING COMMUNICATION FROM D-AUTO"),
    ("By accepting, I authorize Nissan, its affiliates, and its dealers to contact me",
     "By accepting, I authorize D-AUTO, its affiliates, and its dealers to contact me"),
    ("Nissan Offers", "D-AUTO Offers"),
    ("NISSAN SHOWROOMS", "D-AUTO SHOWROOMS"),
    ("Nissan News", "D-AUTO News"),
    ("Nissan Service", "D-AUTO Service"),
    ("NISSAN app", "D-AUTO app"),
    ("contact nissan", "contact d-auto"),
]

# Phrases where a straight word swap reads wrong, so the whole phrase is rewritten.
PHRASES = [
    ("FIND YOUR PERFECT NISSAN", "FIND YOUR PERFECT CAR"),
    ("COMPARE NISSAN MODELS", "COMPARE MODELS"),
    ("NISSAN MODEL MATCHMAKER", "MODEL MATCHMAKER"),
    ("DISCOVER THE NISSAN RANGE", "DISCOVER THE RANGE"),
    ("I OWN A NISSAN", "I OWN A CAR"),
    ("INTERESTED IN NISSAN", "INTERESTED IN A CAR"),
    ("Choose your Nissan", "Choose your car"),
]

# The marque naming a product. None of these may change: a car is a Nissan
# X-TRAIL whoever sells it, and renaming a real model would be inventing one.
PRODUCT = [
    "Nissan X-TRAIL is on it",
    "Find Your Nissan X-Trail 2026",
    "NISSAN INTELLIGENT MOBILITY",
    "Nissan Intelligent Key® with Push Button Ignition",
    "NISSAN GENUINE MOTOR OIL",
    "Nissan Patrol",
    "Nissan KICKS",
    "Nissan MAGNITE",
    "Nissan ALTIMA",
    "Nissan PATHFINDER",
    "Nissan X-TERRA",
    "Nissan TEKTON",
    "Nissan PATROL NISMO",
    "Nissan Connect",
    "Nissan Z",
]

# Copy with nothing to rewrite. A pass that touches these is over-reaching.
UNTOUCHED = [
    "The X-TRAIL is a good car",
    "Book a test drive at your nearest showroom",
    "",
]


def main():
    cases = OWNER + PHRASES + [(s, s) for s in PRODUCT] + [(s, s) for s in UNTOUCHED]
    failed = []
    for source, expected in cases:
        actual = rebrand_text(source)
        if actual != expected:
            failed.append((source, expected, actual))

    for source, expected, actual in failed:
        print(f"FAIL  {source!r}")
        print(f"      expected  {expected!r}")
        print(f"      actual    {actual!r}")

    print(f"{len(cases) - len(failed)}/{len(cases)} pass")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
