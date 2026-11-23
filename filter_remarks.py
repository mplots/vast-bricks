#!/usr/bin/env python3
"""Keep only the BrickStore (.bsx) lots whose remark matches DA_{letter}{digit}{digit}.

    DA_A04  -> kept
    DA_XZ1  -> removed

    python3 filter_remarks.py input.bsx
    python3 filter_remarks.py input.bsx -o filtered.bsx

The file is edited as text, so everything else (formatting, CDATA, GUI state)
is preserved byte for byte.
"""

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

KEEP_RE = re.compile(r"^DA_[A-Z]\d{2}$")
ITEM_RE = re.compile(r"[ \t]*<Item>.*?</Item>\n?", re.S)
REMARKS_RE = re.compile(r"<Remarks>([^<]*)</Remarks>")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="BrickStore .bsx file to filter")
    parser.add_argument("-o", "--output", type=Path, help="output file (default: <input>_filtered.bsx)")
    args = parser.parse_args()

    output = args.output or args.input.with_name(f"{args.input.stem}_filtered{args.input.suffix}")
    if output.resolve() == args.input.resolve():
        sys.exit("Output must differ from input, nothing was written.")

    text = args.input.read_text(encoding="utf-8")
    try:
        ET.fromstring(text.encode("utf-8"))
    except ET.ParseError as error:
        sys.exit(f"{args.input} is not valid XML: {error}")

    kept, removed = 0, {}

    def filter_item(match):
        nonlocal kept
        remarks = REMARKS_RE.search(match.group(0))
        remark = remarks.group(1) if remarks else "(no remark)"
        if KEEP_RE.match(remark):
            kept += 1
            return match.group(0)
        removed[remark] = removed.get(remark, 0) + 1
        return ""

    result = ITEM_RE.sub(filter_item, text)
    ET.fromstring(result.encode("utf-8"))
    output.write_text(result, encoding="utf-8")

    print("Statistics:")
    print(f"  lots total:   {kept + sum(removed.values())}")
    print(f"  lots kept:    {kept}")
    print(f"  lots removed: {sum(removed.values())}")
    for remark, count in sorted(removed.items()):
        print(f"    {remark}: {count}")
    print(f"Written to {output}")


if __name__ == "__main__":
    main()
