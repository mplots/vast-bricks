#!/usr/bin/env python3
"""Rename the prefix of BrickStore (.bsx) lot remarks shaped {prefix}{letter}{digit}{digit}.

    DA_A04  -> AD_A04
    DA_XZ1  -> unchanged (does not match the pattern)

    python3 rename_remark_prefix.py input.bsx DA_ AD_
    python3 rename_remark_prefix.py input.bsx DA_ AD_ -o renamed.bsx

Each renamed lot keeps its old remark as <DifferenceBaseValues Remarks="..."/>,
so BrickStore shows it as a pending change. Lots that do not match, and lots
that already carry a DifferenceBaseValues remark, are left unchanged.

The file is edited as text, so everything else (formatting, CDATA, GUI state)
is preserved byte for byte.
"""

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

PREFIX_RE = re.compile(r"^[A-Z]+_$")
ITEM_RE = re.compile(r"<Item>.*?</Item>", re.S)
REMARKS_RE = re.compile(r"<Remarks>([^<]*)</Remarks>")
DIFF_RE = re.compile(r"<DifferenceBaseValues\b([^>]*?)\s*/>")
DIFF_REMARKS_RE = re.compile(r'\bRemarks="([^"]*)"')
ITEM_END_RE = re.compile(r"(\n([ \t]*))</Item>$")


def rename_item(item, old, new):
    item = REMARKS_RE.sub(f"<Remarks>{new}</Remarks>", item, count=1)
    diff = DIFF_RE.search(item)
    if diff:
        # DifferenceBaseValues already exists for another field: add the remark to it.
        return item[:diff.start()] + f'<DifferenceBaseValues{diff.group(1)} Remarks="{old}"/>' + item[diff.end():]
    end = ITEM_END_RE.search(item)
    return item[:end.start()] + f'\n{end.group(2)} <DifferenceBaseValues Remarks="{old}"/>' + end.group(0)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="BrickStore .bsx file")
    parser.add_argument("old_prefix", help="current remark prefix, e.g. DA_")
    parser.add_argument("new_prefix", help="new remark prefix, e.g. AD_")
    parser.add_argument("-o", "--output", type=Path, help="output file (default: <input>_<new prefix>.bsx)")
    args = parser.parse_args()

    old_prefix, new_prefix = args.old_prefix.upper(), args.new_prefix.upper()
    for prefix in (old_prefix, new_prefix):
        if not PREFIX_RE.match(prefix):
            sys.exit(f"Prefix '{prefix}' must look like DA_, nothing was written.")
    match_re = re.compile(rf"^{re.escape(old_prefix)}([A-Z]\d{{2}})$")

    output = args.output or args.input.with_name(f"{args.input.stem}_{new_prefix.rstrip('_')}{args.input.suffix}")
    if output.resolve() == args.input.resolve():
        sys.exit("Output must differ from input, nothing was written.")

    text = args.input.read_text(encoding="utf-8")
    try:
        ET.fromstring(text.encode("utf-8"))
    except ET.ParseError as error:
        sys.exit(f"{args.input} is not valid XML: {error}")

    renamed, already, unchanged = {}, 0, {}

    def process(match):
        nonlocal already
        item = match.group(0)
        remarks = REMARKS_RE.search(item)
        remark = remarks.group(1) if remarks else "(no remark)"
        diff = DIFF_RE.search(item)
        if diff and DIFF_REMARKS_RE.search(diff.group(1)):
            already += 1
            return item
        source = match_re.match(remark)
        if not source:
            unchanged[remark] = unchanged.get(remark, 0) + 1
            return item
        renamed[remark] = renamed.get(remark, 0) + 1
        return rename_item(item, remark, new_prefix + source.group(1))

    result = ITEM_RE.sub(process, text)
    ET.fromstring(result.encode("utf-8"))
    output.write_text(result, encoding="utf-8")

    total = sum(renamed.values()) + already + sum(unchanged.values())
    print("Statistics:")
    print(f"  lots total:             {total}")
    print(f"  lots renamed:           {sum(renamed.values())} ({len(renamed)} distinct remarks)")
    for remark, count in sorted(renamed.items()):
        print(f"    {remark} -> {new_prefix}{remark[len(old_prefix):]}: {count}")
    print(f"  lots already migrated:  {already}")
    print(f"  lots unchanged:         {sum(unchanged.values())}")
    for remark, count in sorted(unchanged.items()):
        print(f"    {remark}: {count}")
    print(f"Written to {output}")


if __name__ == "__main__":
    main()
