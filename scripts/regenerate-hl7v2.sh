#!/bin/bash
# Regenerate HL7v2 type definitions from @atomic-ehr/hl7v2

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/src/hl7v2/generated"

echo "Regenerating HL7v2 types in $OUTPUT_DIR..."
cd "$PROJECT_DIR/node_modules/@atomic-ehr/hl7v2"
bun src/hl7v2/codegen.ts "$OUTPUT_DIR" BAR_P01 ORM_O01 ORU_R01 VXU_V04

echo "Done!"
