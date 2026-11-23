#!/usr/bin/env python3
"""Migrate BrickStore (.bsx) lot remarks from two 60-slot series to one 120-slot series.

Example: MA_A01..MA_A60 + MA_B01..MA_B60  ->  AM_A001..AM_A120

    python3 migrate_remarks.py migration.bsx AM_A
    python3 migrate_remarks.py migration.bsx AM_B -o migrated.bsx
    python3 migrate_remarks.py migration.bsx AM_B --allow-missing

The alphabetically first source series maps to 001-060, the second to 061-120.
Each changed lot keeps its old remark as <DifferenceBaseValues Remarks="..."/>,
so BrickStore shows it as a pending change. Lots already migrated (new remark
plus a DifferenceBaseValues remark) are validated and left as they are.

The file is edited as text, so everything else (formatting, CDATA, GUI state)
is preserved byte for byte.
"""

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SERIES_SIZE = 60
SOURCE_RE = re.compile(r"^([A-Z]+_[A-Z])(\d{2})$")
TARGET_RE = re.compile(r"^[A-Z]+_[A-Z]$")

ITEM_RE = re.compile(r"<Item>.*?</Item>", re.S)
REMARKS_RE = re.compile(r"<Remarks>([^<]*)</Remarks>")
DIFF_RE = re.compile(r"<DifferenceBaseValues\b([^>]*?)\s*/>")
DIFF_REMARKS_RE = re.compile(r'\bRemarks="([^"]*)"')
ITEM_END_RE = re.compile(r"(\n([ \t]*))</Item>$")


def fail(errors):
    sys.stdout.flush()
    print("Migration aborted, nothing was written:", file=sys.stderr)
    for error in errors:
        print(f"  - {error}", file=sys.stderr)
    sys.exit(1)


def lot_id(item):
    match = re.search(r"<LotID>([^<]*)</LotID>", item)
    return match.group(1) if match else "?"


def parse_items(text):
    """Return (item match, current remark, original remark or None) per lot, and lots without a remark."""
    items, no_remark = [], []
    for match in ITEM_RE.finditer(text):
        item = match.group(0)
        remarks = REMARKS_RE.search(item)
        if not remarks:
            no_remark.append(lot_id(item))
            continue
        diff = DIFF_RE.search(item)
        diff_remarks = DIFF_REMARKS_RE.search(diff.group(1)) if diff else None
        original = diff_remarks.group(1) if diff_remarks else None
        items.append((match, remarks.group(1), original))
    return items, no_remark


def print_statistics(items, no_remark, series, unexpected):
    expected = set(range(1, SERIES_SIZE + 1))
    lots_per_remark = {}
    for match, current, original in items:
        source = original if original is not None else current
        lots_per_remark[source] = lots_per_remark.get(source, 0) + 1

    print("Statistics:")
    print(f"  lots total:             {len(items) + len(no_remark)}")
    print(f"  lots without remark:    {len(no_remark)}" + (f" (lots {', '.join(no_remark)})" if no_remark else ""))
    print(f"  lots unexpected remark: {sum(unexpected.values())}"
          + (f" ({', '.join(f'{r} x{n}' for r, n in sorted(unexpected.items()))})" if unexpected else ""))
    found = 0
    for prefix, numbers in sorted(series.items()):
        valid = numbers & expected
        missing = sorted(expected - numbers)
        extra = sorted(numbers - expected)
        lots = sum(n for r, n in lots_per_remark.items() if r.startswith(prefix) and SOURCE_RE.match(r))
        found += len(valid)
        print(f"  series {prefix}: {len(valid)}/{SERIES_SIZE} remarks present, {lots} lots, {len(missing)} missing"
              + (f": {', '.join(f'{prefix}{n:02d}' for n in missing)}" if missing else ""))
        if extra:
            print(f"    out of range: {', '.join(f'{prefix}{n:02d}' for n in extra)}")
    print(f"  remarks total:          {found}/{2 * SERIES_SIZE} present, {2 * SERIES_SIZE - found} missing")
    if len(series) < 2:
        print(f"  series missing:         {2 - len(series)} (found {', '.join(sorted(series)) or 'none'})")


def build_mapping(items, no_remark, target, allow_missing):
    """Validate the source remarks, print statistics and map each source remark to its new one."""
    errors = []
    sources = set()
    unexpected = {}
    for match, current, original in items:
        source = original if original is not None else current
        if SOURCE_RE.match(source):
            sources.add(source)
        else:
            unexpected[source] = unexpected.get(source, 0) + 1

    series = {}
    for source in sources:
        prefix, number = SOURCE_RE.match(source).groups()
        series.setdefault(prefix, set()).add(int(number))

    expected = set(range(1, SERIES_SIZE + 1))
    missing = [f"{prefix}{n:02d}" for prefix, numbers in sorted(series.items()) for n in sorted(expected - numbers)]
    if missing:
        print(f"MISSING REMARKS ({len(missing)}): {', '.join(missing)}\n")

    print_statistics(items, no_remark, series, unexpected)

    if no_remark:
        errors.append(f"{len(no_remark)} lots have no remark")
    if unexpected:
        errors.append(f"{sum(unexpected.values())} lots have an unexpected remark")
    if len(series) != 2:
        errors.append(f"expected exactly 2 source series, found {len(series)}")
    for prefix, numbers in sorted(series.items()):
        if expected - numbers and not allow_missing:
            errors.append(f"series {prefix} is missing {len(expected - numbers)} remarks: "
                          + ", ".join(f"{prefix}{n:02d}" for n in sorted(expected - numbers)))
        if numbers - expected:
            errors.append(f"series {prefix} has {len(numbers - expected)} out-of-range remarks: "
                          + ", ".join(f"{prefix}{n:02d}" for n in sorted(numbers - expected)))
    if errors:
        fail(errors)

    mapping = {}
    for offset, prefix in enumerate(sorted(series)):
        for number in range(1, SERIES_SIZE + 1):
            mapping[f"{prefix}{number:02d}"] = f"{target}{offset * SERIES_SIZE + number:03d}"
    return mapping, sorted(series)


def migrate_item(item, current, new):
    item = REMARKS_RE.sub(f"<Remarks>{new}</Remarks>", item, count=1)
    diff = DIFF_RE.search(item)
    if diff:
        # DifferenceBaseValues already exists for another field: add the remark to it.
        return item[:diff.start()] + f'<DifferenceBaseValues{diff.group(1)} Remarks="{current}"/>' + item[diff.end():]
    end = ITEM_END_RE.search(item)
    indent = end.group(2)
    child_indent = indent + " "
    return item[:end.start()] + f'\n{child_indent}<DifferenceBaseValues Remarks="{current}"/>' + end.group(0)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="BrickStore .bsx file to migrate")
    parser.add_argument("target", help="new remark series prefix, e.g. AM_A or AM_B")
    parser.add_argument("--allow-missing", action="store_true",
                        help="migrate even when some of the 120 remarks have no lot; numbering stays fixed")
    parser.add_argument("-o", "--output", type=Path, help="output file (default: <input>_<target>.bsx)")
    args = parser.parse_args()

    target = args.target.upper()
    if not TARGET_RE.match(target):
        fail([f"target '{args.target}' must look like AM_A"])

    text = args.input.read_text(encoding="utf-8")
    try:
        ET.fromstring(text.encode("utf-8"))
    except ET.ParseError as error:
        fail([f"{args.input} is not valid XML: {error}"])

    items, no_remark = parse_items(text)
    if not items and not no_remark:
        fail(["no <Item> lots found"])
    mapping, source_series = build_mapping(items, no_remark, target, args.allow_missing)
    errors = []

    # Lots migrated earlier must already carry exactly the remark this run would give them.
    for match, current, original in items:
        if original is not None and current != mapping[original]:
            errors.append(f"lot {lot_id(match.group(0))} was migrated {original} -> {current}, expected {mapping[original]}")
    if errors:
        fail(errors)

    parts, last, migrated, skipped = [], 0, 0, 0
    for match, current, original in items:
        if original is not None:
            skipped += 1
            continue
        parts.append(text[last:match.start()])
        parts.append(migrate_item(match.group(0), current, mapping[current]))
        last = match.end()
        migrated += 1
    parts.append(text[last:])
    result = "".join(parts)
    ET.fromstring(result.encode("utf-8"))

    output = args.output or args.input.with_name(f"{args.input.stem}_{target}{args.input.suffix}")
    if output.resolve() == args.input.resolve():
        fail(["output must differ from input"])
    output.write_text(result, encoding="utf-8")

    first, second = source_series
    print(f"{first}01-{first}60 -> {target}001-{target}060")
    print(f"{second}01-{second}60 -> {target}061-{target}120")
    print(f"{migrated} lots migrated, {skipped} already migrated, written to {output}")


if __name__ == "__main__":
    main()
