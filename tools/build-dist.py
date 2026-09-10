#!/usr/bin/env python3
"""Assemble the publishable site into dist/.

WHY THIS EXISTS. A static host publishes whatever is in the directory it is
pointed at. Pointing one at the repository root publishes the repository: the
panel runbook, the demo script, the persona list, the edge function sources and
the capture material all answered 200 on the published site, to anyone who
typed the path. Making the repository private does not change that, because the
host serves the files either way. So the host is pointed at dist/, and dist/
holds the site and nothing else.

It also guards the publish. The Dengage account id ships as the placeholder
0000, and a bundle built on that placeholder looks completely normal: every
page renders, every control works, and not one event reaches Dengage. The other
way to be wrong is to publish against account 28, which is shared with other
demonstrations, so a new site pointed there writes its rows into somebody
else's data. Both are refused here rather than discovered on a call.

Run:
    python3 tools/build-dist.py                 # refuses an unconfigured build
    python3 tools/build-dist.py --unconfigured  # local preview before the account exists
    python3 tools/build-dist.py --allow-shared-account   # publish against account 28 on purpose

Then point the host's build output directory at dist/.
"""
import argparse
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# Everything in the repository that is not the site. A new page directory is
# published without touching this file; a new internal directory is not, and
# that asymmetry is deliberate: forgetting to exclude something publishes it.
NOT_THE_SITE = {
    ".git", ".github", ".preview", "dist", "docs", "deck",
    "panel", "tools", "supabase", "reference", "node_modules", "__pycache__",
}
NOT_THE_SITE_FILES = {
    ".gitignore", "README.md", "HANDOVER.md", ".DS_Store",
}

# The account that other demonstrations already write to. A new site pointed at
# it puts its rows in with theirs, in tables that cannot be told apart
# afterwards, and nothing about the site would look wrong.
SHARED_ACCOUNT = "28"

CONFIGS = ["js/config.js", "lincoln/js/config.js"]


def read_account(path: pathlib.Path):
    text = path.read_text()
    account = re.search(r"accountId:\s*'([^']*)'", text)
    guid = re.search(r"appGuid:\s*'([^']*)'", text)
    return (account.group(1) if account else None,
            guid.group(1) if guid else None)


def account_problems(rel, account, guid, allow_unconfigured, allow_shared) -> list:
    """The whole decision, as a function of the values, so it can be tested.

    A guard that is only ever exercised by the state of the working tree is a
    guard nobody has seen fail."""
    if account is None or guid is None:
        return [f"{rel} has no accountId or appGuid to read"]

    problems = []
    unset = not account or account == "0000" or guid.startswith("__")
    if unset and not allow_unconfigured:
        problems.append(
            f"{rel} still holds the placeholder account ({account}, {guid}). "
            "Every page would render and nothing would reach Dengage. "
            "Set both values, or pass --unconfigured for a local preview.")
    if account == SHARED_ACCOUNT and not allow_shared:
        problems.append(
            f"{rel} points at account {SHARED_ACCOUNT}, which is shared with other "
            "demonstrations. Rows written from here would land in with theirs and "
            "could not be told apart afterwards. Pass --allow-shared-account if "
            "that is genuinely what you want.")
    return problems


def check_accounts(allow_unconfigured: bool, allow_shared: bool) -> list:
    problems = []
    for rel in CONFIGS:
        path = ROOT / rel
        if not path.exists():
            problems.append(f"{rel} is missing, so the Dengage account cannot be read")
            continue
        account, guid = read_account(path)
        problems.extend(account_problems(rel, account, guid, allow_unconfigured, allow_shared))
    return problems


def copy_site() -> tuple:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    files = 0
    for entry in sorted(ROOT.iterdir()):
        if entry.name.startswith(".") and entry.name not in {".nojekyll"}:
            continue
        if entry.is_dir():
            if entry.name in NOT_THE_SITE:
                continue
            shutil.copytree(entry, DIST / entry.name)
            files += sum(1 for _ in (DIST / entry.name).rglob("*") if _.is_file())
        else:
            if entry.name in NOT_THE_SITE_FILES:
                continue
            shutil.copy2(entry, DIST / entry.name)
            files += 1
    return files, sum(f.stat().st_size for f in DIST.rglob("*") if f.is_file())


def check_output() -> list:
    """The point of the whole exercise, asserted rather than assumed."""
    problems = []
    for name in ("panel", "tools", "supabase", "reference"):
        if (DIST / name).exists():
            problems.append(f"dist/{name}/ was published and must not be")
    for name in ("README.md", "HANDOVER.md"):
        if (DIST / name).exists():
            problems.append(f"dist/{name} was published and must not be")

    # Push arms only from a root scoped worker at exactly this path.
    if not (DIST / "dengage-webpush-sw.js").exists():
        problems.append("dist/dengage-webpush-sw.js is missing, so web push would never register")

    for required in ("index.html", "manifest.webmanifest", "js/config.js",
                     "lincoln/index.html", "dealer/index.html", "verify/index.html"):
        if not (DIST / required).exists():
            problems.append(f"dist/{required} is missing")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--unconfigured", action="store_true",
                        help="build with the placeholder Dengage account, for a local preview")
    parser.add_argument("--allow-shared-account", action="store_true",
                        help="build against the shared account on purpose")
    args = parser.parse_args()

    problems = check_accounts(args.unconfigured, args.allow_shared_account)
    if problems:
        print("Refusing to build:\n")
        for problem in problems:
            print(f"  {problem}\n")
        return 1

    files, size = copy_site()
    problems = check_output()
    if problems:
        print("Built, but the result is wrong:\n")
        for problem in problems:
            print(f"  {problem}")
        return 1

    for rel in CONFIGS:
        account, guid = read_account(ROOT / rel)
        print(f"  {rel:24s} account {account}  app {guid}")
    print(f"\ndist/  {files} files, {size / 1048576:.1f} MB")
    print("panel, tools, supabase and reference are not in it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
