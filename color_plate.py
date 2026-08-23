#!/usr/bin/env python3
"""Pick one inventory item per color for building a LEGO color plate.

The script reads a BrickStore .bsx inventory and prints the best item to use
for each unique color. Ranking is intentionally practical:

1. Used parts before new parts.
2. Plain parts before printed/decorated parts with long descriptions.
3. Smaller parts before larger parts.
4. Category order, with Technic parts demoted.
"""

from __future__ import annotations

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


DIMENSION_RE = re.compile(
    r"(?<![\d.])(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?(?![\d.])",
    re.IGNORECASE,
)
DECORATED_WORDS = (
    "decorated",
    "pattern",
    "sticker",
    "print",
    "pb",
)


@dataclass(frozen=True)
class InventoryItem:
    item_id: str
    item_name: str
    category_name: str
    color_name: str
    condition: str
    qty: int
    remarks: str
    lot_id: str


def text(item: ET.Element, name: str) -> str:
    value = item.findtext(name)
    return value.strip() if value else ""


def parse_quantity(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        return 0


def parse_inventory(path: Path) -> list[InventoryItem]:
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        raise SystemExit(f"Could not parse {path}: {exc}") from exc

    items: list[InventoryItem] = []
    for item in root.findall("./Inventory/Item"):
        color_name = text(item, "ColorName")
        item_name = text(item, "ItemName")
        qty = parse_quantity(text(item, "Qty"))
        if not color_name or not item_name or qty <= 0:
            continue

        items.append(
            InventoryItem(
                item_id=text(item, "ItemID"),
                item_name=item_name,
                category_name=text(item, "CategoryName"),
                color_name=color_name,
                condition=text(item, "Condition"),
                qty=qty,
                remarks=text(item, "Remarks"),
                lot_id=text(item, "LotID"),
            )
        )
    return items


def condition_rank(item: InventoryItem) -> int:
    return 0 if item.condition.upper() == "U" else 1


def category_rank(item: InventoryItem) -> int:
    category = item.category_name.lower()
    name = item.item_name.lower()
    combined = f"{category} {name}"

    if "technic" in combined:
        return 6
    if category == "tile" or category.startswith("tile,"):
        return 0
    if category == "plate":
        return 1
    if category == "brick":
        return 2
    if category == "plate, modified":
        return 3
    if category == "brick, modified":
        return 4
    return 5


def technic_rank(item: InventoryItem) -> int:
    combined = f"{item.category_name} {item.item_name}".lower()
    return 1 if "technic" in combined else 0


def plainness_rank(item: InventoryItem) -> int:
    combined = f"{item.category_name} {item.item_name}".lower()
    if any(word in combined for word in DECORATED_WORDS):
        return 2
    if len(item.item_name) > 60:
        return 1
    return 0


def size_score(item: InventoryItem) -> tuple[int, int, int]:
    """Return a comparable size score based on dimensions in the item name.

    BrickLink-style names usually contain dimensions such as "1 x 1" or
    "1 x 2 x 2". The first score is area/volume, then largest dimension, then
    dimension count. Items with no dimensions are placed after dimensioned
    parts within their condition/category group.
    """

    matches = list(DIMENSION_RE.finditer(item.item_name))
    if not matches:
        return (9999, 9999, 9999)

    best: tuple[int, int, int] | None = None
    for match in matches:
        dims = [int(group) for group in match.groups() if group]
        if not dims:
            continue

        measure = 1
        for dim in dims:
            measure *= dim

        score = (measure, max(dims), len(dims))
        if best is None or score < best:
            best = score

    return best if best is not None else (9999, 9999, 9999)


def item_size_label(item: InventoryItem) -> str:
    matches = list(DIMENSION_RE.finditer(item.item_name))
    if not matches:
        return "No size in name"

    best_match: tuple[tuple[int, int, int], list[int]] | None = None
    for match in matches:
        dims = [int(group) for group in match.groups() if group]
        if not dims:
            continue

        measure = 1
        for dim in dims:
            measure *= dim

        score = (measure, max(dims), len(dims))
        if best_match is None or score < best_match[0]:
            best_match = (score, dims)

    if best_match is None:
        return "No size in name"
    return " x ".join(str(dim) for dim in best_match[1])


def item_sort_key(item: InventoryItem) -> tuple[object, ...]:
    return (
        condition_rank(item),
        plainness_rank(item),
        technic_rank(item),
        size_score(item),
        category_rank(item),
        item.item_name.lower(),
        item.item_id,
        item.lot_id,
    )


def pick_color_items(items: list[InventoryItem]) -> list[InventoryItem]:
    best_by_color: dict[str, InventoryItem] = {}
    for item in items:
        current = best_by_color.get(item.color_name)
        if current is None or item_sort_key(item) < item_sort_key(current):
            best_by_color[item.color_name] = item
    return sorted(best_by_color.values(), key=lambda item: item.color_name.lower())


def print_table(items: list[InventoryItem]) -> None:
    headers = ["Color", "Use this part", "Condition", "Qty", "Remarks"]
    rows = [
        [
            item.color_name,
            f"{item.item_name} ({item.item_id})",
            item.condition or "-",
            str(item.qty),
            item.remarks or "-",
        ]
        for item in items
    ]
    widths = [
        max(len(headers[index]), *(len(row[index]) for row in rows))
        for index in range(len(headers))
    ]

    print(" | ".join(header.ljust(widths[index]) for index, header in enumerate(headers)))
    print("-+-".join("-" * width for width in widths))
    for row in rows:
        print(" | ".join(value.ljust(widths[index]) for index, value in enumerate(row)))


def print_size_summary(items: list[InventoryItem]) -> None:
    size_counts = Counter(item_size_label(item) for item in items)

    def summary_sort_key(entry: tuple[str, int]) -> tuple[int, int, int, int, str]:
        label, _ = entry
        if label == "No size in name":
            return (1, 9999, 9999, 9999, label)
        dims = [int(part.strip()) for part in label.split(" x ")]
        measure = 1
        for dim in dims:
            measure *= dim
        return (0, measure, max(dims), len(dims), label)

    print("\nSize summary:")
    for size, count in sorted(size_counts.items(), key=summary_sort_key):
        print(f"{size}: {count}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Find unique BrickStore colors and the best part to use for each one."
    )
    parser.add_argument(
        "bsx_file",
        nargs="?",
        default="store.bsx",
        help="Path to the BrickStore .bsx inventory file. Defaults to store.bsx.",
    )
    args = parser.parse_args()

    bsx_path = Path(args.bsx_file)
    if not bsx_path.exists():
        print(f"File not found: {bsx_path}", file=sys.stderr)
        return 1

    items = parse_inventory(bsx_path)
    selected_items = pick_color_items(items)
    print_table(selected_items)
    print(f"\nUnique colors: {len(selected_items)}")
    print_size_summary(selected_items)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
