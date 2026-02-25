#!/usr/bin/env python3
"""Inspect HL7v2 message files for AI agent analysis.

Usage:
  python3 scripts/hl7v2-inspect.py <file>              # Structure overview (safe, no PHI)
  python3 scripts/hl7v2-inspect.py <file> --values      # Show field values (may contain PHI!)
  python3 scripts/hl7v2-inspect.py <file> --segment PV1  # Filter to specific segment type
  python3 scripts/hl7v2-inspect.py <file> --field RXA.6  # Show specific field with components
  python3 scripts/hl7v2-inspect.py <file> --verify RXA.20  # Verify field position by pipe counting
"""
import sys
import re
import argparse

SEGMENT_NAMES = {"MSH", "PID", "PV1", "PV2", "PD1", "NK1", "ORC", "OBR", "OBX",
                 "RXA", "RXR", "SPM", "NTE", "AL1", "DG1", "GT1", "IN1", "IN2",
                 "IN3", "TQ1", "TQ2", "SFT", "UAC", "ARV", "PRT", "EVN", "MRG",
                 "ROL", "FT1", "ACC", "UB1", "UB2", "RXE", "RXD", "RXG", "RXC"}


def extract_messages(content: str) -> list[list[str]]:
    """Extract HL7v2 messages from file content. Handles RTF wrappers and multi-message files."""
    # Strip RTF formatting if present
    if content.startswith("{\\rtf"):
        content = re.sub(r"\\[a-z]+\d*\s?", "", content)
        content = re.sub(r"[{}]", "", content)

    lines = []
    for line in content.split("\n"):
        line = line.strip()
        if not line:
            continue
        seg = line.split("|")[0].strip()
        if seg in SEGMENT_NAMES or (seg == "MSH" and "|" in line):
            lines.append(line)

    # Split into messages (each MSH starts a new message)
    messages: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if line.startswith("MSH|"):
            if current:
                messages.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        messages.append(current)

    return messages


def describe_component(value: str) -> str:
    """Describe a component value without showing PHI."""
    if not value:
        return "(empty)"
    if "^" in value:
        parts = value.split("^")
        non_empty = sum(1 for p in parts if p)
        return f"({non_empty}/{len(parts)} components)"
    if "~" in value:
        repeats = value.split("~")
        return f"({len(repeats)} repeats)"
    return f"(len={len(value)})"


def show_structure(messages: list[list[str]]):
    """Show message structure overview (no PHI)."""
    for i, msg in enumerate(messages):
        if len(messages) > 1:
            print(f"=== Message {i + 1} of {len(messages)} ===")
        for line in msg:
            parts = line.split("|")
            seg = parts[0]
            # For MSH, field 1 is the separator itself
            if seg == "MSH":
                total_fields = len(parts) - 1
            else:
                total_fields = len(parts) - 1

            populated = []
            start = 1 if seg != "MSH" else 1
            for j, val in enumerate(parts[start:], start):
                if seg == "MSH" and j == 1:
                    continue  # Skip encoding characters
                if val.strip():
                    desc = describe_component(val)
                    populated.append(f"{j}{desc}")

            print(f"  {seg} ({total_fields} fields) populated: {', '.join(populated)}")
        if len(messages) > 1:
            print()


def show_values(messages: list[list[str]], segment_filter: str | None = None):
    """Show field values (WARNING: may contain PHI)."""
    for i, msg in enumerate(messages):
        if len(messages) > 1:
            print(f"=== Message {i + 1} of {len(messages)} ===")
        for line in msg:
            parts = line.split("|")
            seg = parts[0]
            if segment_filter and seg != segment_filter:
                continue

            print(f"  {seg}:")
            for j, val in enumerate(parts[1:], 1):
                if seg == "MSH" and j == 1:
                    print(f"    Field {j}: (encoding chars)")
                    continue
                if val.strip():
                    if "^" in val:
                        components = val.split("^")
                        comp_str = " | ".join(
                            f"C{k + 1}={c}" if c else f"C{k + 1}=(empty)"
                            for k, c in enumerate(components)
                        )
                        print(f"    Field {j}: {comp_str}")
                    elif "~" in val:
                        repeats = val.split("~")
                        for r_idx, repeat in enumerate(repeats):
                            if "^" in repeat:
                                components = repeat.split("^")
                                comp_str = " | ".join(
                                    f"C{k + 1}={c}" if c else f"C{k + 1}=(empty)"
                                    for k, c in enumerate(components)
                                )
                                print(f"    Field {j}[{r_idx + 1}]: {comp_str}")
                            else:
                                print(f"    Field {j}[{r_idx + 1}]: {repeat}")
                    else:
                        print(f"    Field {j}: {val}")
                else:
                    pass  # Skip empty fields for readability
        if len(messages) > 1:
            print()


def show_field(messages: list[list[str]], field_spec: str):
    """Show a specific field across all messages. Format: SEG.N (e.g., RXA.6)"""
    try:
        seg_type, field_num = field_spec.split(".")
        field_num = int(field_num)
    except ValueError:
        print(f"Error: invalid field spec '{field_spec}'. Use format SEG.N (e.g., RXA.6)")
        sys.exit(1)

    seg_type = seg_type.upper()
    for i, msg in enumerate(messages):
        if len(messages) > 1:
            print(f"--- Message {i + 1} ---")
        for line in msg:
            parts = line.split("|")
            seg = parts[0]
            if seg != seg_type:
                continue

            if field_num >= len(parts):
                print(f"  {seg}-{field_num}: (not present, only {len(parts) - 1} fields)")
                continue

            val = parts[field_num]
            if not val.strip():
                print(f"  {seg}-{field_num}: (empty)")
                continue

            if "^" in val:
                components = val.split("^")
                print(f"  {seg}-{field_num}: {val}")
                for k, c in enumerate(components):
                    label = f"    .{k + 1}"
                    print(f"{label}: {c if c else '(empty)'}")
            elif "~" in val:
                repeats = val.split("~")
                print(f"  {seg}-{field_num}: ({len(repeats)} repeats)")
                for r_idx, repeat in enumerate(repeats):
                    print(f"    [{r_idx + 1}]: {repeat}")
            else:
                print(f"  {seg}-{field_num}: {val}")


def verify_field(messages: list[list[str]], field_spec: str):
    """Verify field position by explicit pipe counting. Format: SEG.N (e.g., RXA.20)"""
    try:
        seg_type, field_num = field_spec.split(".")
        field_num = int(field_num)
    except ValueError:
        print(f"Error: invalid field spec '{field_spec}'. Use format SEG.N (e.g., RXA.20)")
        sys.exit(1)

    seg_type = seg_type.upper()
    for i, msg in enumerate(messages):
        if len(messages) > 1:
            print(f"--- Message {i + 1} ---")
        for line in msg:
            parts = line.split("|")
            seg = parts[0]
            if seg != seg_type:
                continue

            total = len(parts) - 1
            if field_num > total:
                print(f"  {seg}: has {total} fields, requested field {field_num} is beyond end")
                print(f"  Need {field_num - total} more pipes to reach field {field_num}")
                continue

            val = parts[field_num] if field_num < len(parts) else "(absent)"
            val_display = val if val.strip() else "(empty)"

            # Show context: fields around the target
            context_start = max(1, field_num - 2)
            context_end = min(total + 1, field_num + 3)
            context_parts = []
            for j in range(context_start, context_end):
                v = parts[j] if j < len(parts) else ""
                marker = " <<< " if j == field_num else ""
                v_display = v if v.strip() else "(empty)"
                context_parts.append(f"    Field {j}: {v_display}{marker}")

            print(f"  {seg} ({total} fields total), field {field_num} = {val_display}")
            print("  Context:")
            print("\n".join(context_parts))


def main():
    parser = argparse.ArgumentParser(description="Inspect HL7v2 message files")
    parser.add_argument("file", help="Path to HL7v2 message file")
    parser.add_argument("--values", action="store_true",
                        help="Show field values (may contain PHI!)")
    parser.add_argument("--segment", type=str, default=None,
                        help="Filter to specific segment type (e.g., RXA)")
    parser.add_argument("--field", type=str, default=None,
                        help="Show specific field with components (e.g., RXA.6)")
    parser.add_argument("--verify", type=str, default=None,
                        help="Verify field position by pipe counting (e.g., RXA.20)")
    args = parser.parse_args()

    try:
        with open(args.file) as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: file not found: {args.file}")
        sys.exit(1)

    messages = extract_messages(content)
    if not messages:
        print("No HL7v2 messages found in file")
        sys.exit(1)

    print(f"Found {len(messages)} message(s)\n")

    if args.verify:
        verify_field(messages, args.verify)
    elif args.field:
        show_field(messages, args.field)
    elif args.values:
        show_values(messages, args.segment)
    else:
        show_structure(messages)


if __name__ == "__main__":
    main()
