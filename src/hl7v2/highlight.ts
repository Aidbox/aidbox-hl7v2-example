/**
 * HL7v2 Message Highlighter with Schema Metadata
 *
 * Parses HL7v2 messages and generates HTML with tooltips showing
 * field names, data types, and other metadata from the HL7v2 schema.
 */

// Import schema data
const segments = require("../../hl7v2/schema/segments");
const fields = require("../../hl7v2/schema/fields");
const dataTypes = require("../../hl7v2/schema/dataTypes");

interface FieldMeta {
  fieldId: string;
  longName: string;
  dataType: string;
  required: boolean;
}

interface ComponentMeta {
  componentId: string;
  longName: string;
  dataType: string;
}

/**
 * Get field metadata for a segment field (e.g., "MSH.9")
 */
function getFieldMeta(segmentName: string, fieldIndex: number): FieldMeta | null {
  const fieldId = `${segmentName}.${fieldIndex}`;
  const fieldDef = fields[fieldId];
  const segmentDef = segments[segmentName];

  if (!fieldDef) return null;

  // Find if field is required from segment definition
  let required = false;
  if (segmentDef?.fields) {
    const fieldSpec = segmentDef.fields.find(
      (f: { field: string; minOccurs: string }) => f.field === fieldId
    );
    required = fieldSpec?.minOccurs === "1";
  }

  return {
    fieldId,
    longName: fieldDef.longName || fieldId,
    dataType: fieldDef.dataType || "",
    required,
  };
}

/**
 * Get component metadata for a datatype component (e.g., "XPN.1")
 */
function getComponentMeta(dataTypeName: string, componentIndex: number): ComponentMeta | null {
  const componentId = `${dataTypeName}.${componentIndex}`;
  const componentDef = dataTypes[componentId];

  if (!componentDef) return null;

  return {
    componentId,
    longName: componentDef.longName || componentId,
    dataType: componentDef.dataType || "",
  };
}

/**
 * Get subcomponent metadata (e.g., "FN.1" for family name surname)
 */
function getSubcomponentMeta(dataTypeName: string, subIndex: number): ComponentMeta | null {
  const subId = `${dataTypeName}.${subIndex}`;
  const subDef = dataTypes[subId];

  if (!subDef) return null;

  return {
    componentId: subId,
    longName: subDef.longName || subId,
    dataType: subDef.dataType || "",
  };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate tooltip HTML for a field/component
 */
function tooltip(meta: { longName: string; dataType?: string; fieldId?: string; componentId?: string }, value: string): string {
  const id = meta.fieldId || meta.componentId || "";
  const dt = meta.dataType ? ` (${meta.dataType})` : "";
  const title = `${id}: ${meta.longName}${dt}`;
  const escapedValue = escapeHtml(value);

  if (!escapedValue) return "";

  return `<span class="hl7-field" title="${escapeHtml(title)}">${escapedValue}</span>`;
}

/**
 * Parse and highlight subcomponents (& separated)
 */
function highlightSubcomponents(
  value: string,
  parentDataType: string
): string {
  // Look up the parent data type to see if it has subcomponents
  const parentDef = dataTypes[parentDataType];
  if (!parentDef?.components) {
    return escapeHtml(value);
  }

  const subValues = value.split("&");
  const parts: string[] = [];

  for (let i = 0; i < subValues.length; i++) {
    const subValue = subValues[i];
    if (!subValue) {
      parts.push("");
      continue;
    }

    const subMeta = getSubcomponentMeta(parentDataType, i + 1);
    if (subMeta) {
      parts.push(tooltip(subMeta, subValue));
    } else {
      parts.push(escapeHtml(subValue));
    }
  }

  return parts.join('<span class="hl7-delim hl7-sub">&amp;</span>');
}

/**
 * Parse and highlight components (^ separated)
 */
function highlightComponents(
  value: string,
  fieldDataType: string,
  segmentName: string,
  fieldIndex: number
): string {
  // Look up the field data type to see if it has components
  const typeDef = dataTypes[fieldDataType];
  if (!typeDef?.components) {
    // Primitive type, just return escaped value
    return escapeHtml(value);
  }

  const compValues = value.split("^");
  const parts: string[] = [];

  for (let i = 0; i < compValues.length; i++) {
    const compValue = compValues[i];
    if (!compValue) {
      parts.push("");
      continue;
    }

    const compMeta = getComponentMeta(fieldDataType, i + 1);
    if (compMeta) {
      // Check if this component has subcomponents
      const compTypeDef = dataTypes[compMeta.dataType];
      if (compTypeDef?.components && compValue.includes("&")) {
        parts.push(highlightSubcomponents(compValue, compMeta.dataType));
      } else {
        parts.push(tooltip(compMeta, compValue));
      }
    } else {
      parts.push(escapeHtml(compValue));
    }
  }

  return parts.join('<span class="hl7-delim hl7-comp">^</span>');
}

/**
 * Parse and highlight field repetitions (~ separated)
 */
function highlightRepetitions(
  value: string,
  fieldDataType: string,
  segmentName: string,
  fieldIndex: number
): string {
  const reps = value.split("~");
  const parts: string[] = [];

  for (const rep of reps) {
    if (!rep) {
      parts.push("");
      continue;
    }

    if (rep.includes("^")) {
      parts.push(highlightComponents(rep, fieldDataType, segmentName, fieldIndex));
    } else {
      // Single value, check for subcomponents
      const typeDef = dataTypes[fieldDataType];
      if (typeDef?.components) {
        const compMeta = getComponentMeta(fieldDataType, 1);
        if (compMeta) {
          parts.push(tooltip(compMeta, rep));
        } else {
          parts.push(escapeHtml(rep));
        }
      } else {
        parts.push(escapeHtml(rep));
      }
    }
  }

  return parts.join('<span class="hl7-delim hl7-rep">~</span>');
}

/**
 * Highlight a single HL7v2 segment line
 */
function highlightSegment(line: string): string {
  if (!line || line.length < 3) {
    return escapeHtml(line);
  }

  const segmentName = line.substring(0, 3);

  // Special handling for MSH segment (field separator is position 3)
  if (segmentName === "MSH") {
    return highlightMSH(line);
  }

  // Regular segment - split by pipe
  const pipeChar = "|";
  const fieldValues = line.split(pipeChar);
  const parts: string[] = [];

  // First part is segment name
  parts.push(`<span class="hl7-segment">${escapeHtml(fieldValues[0])}</span>`);

  // Process each field
  for (let i = 1; i < fieldValues.length; i++) {
    const fieldValue = fieldValues[i];
    const fieldIndex = i; // For non-MSH segments, field index matches array position

    if (!fieldValue) {
      parts.push("");
      continue;
    }

    const fieldMeta = getFieldMeta(segmentName, fieldIndex);

    if (fieldMeta) {
      // Wrap the entire field with tooltip showing field name
      const fieldDataType = fieldMeta.dataType;

      let inner: string;
      if (fieldValue.includes("~")) {
        inner = highlightRepetitions(fieldValue, fieldDataType, segmentName, fieldIndex);
      } else if (fieldValue.includes("^")) {
        inner = highlightComponents(fieldValue, fieldDataType, segmentName, fieldIndex);
      } else {
        // Single value
        inner = escapeHtml(fieldValue);
      }

      // Wrap with field-level tooltip
      const title = `${fieldMeta.fieldId}: ${fieldMeta.longName} (${fieldMeta.dataType})${fieldMeta.required ? " [R]" : ""}`;
      parts.push(`<span class="hl7-field-wrap" title="${escapeHtml(title)}">${inner}</span>`);
    } else {
      parts.push(escapeHtml(fieldValue));
    }
  }

  return parts.join('<span class="hl7-delim hl7-pipe">|</span>');
}

/**
 * Special handling for MSH segment where field numbering is offset
 */
function highlightMSH(line: string): string {
  // MSH.1 is the field separator character itself (position 3)
  // MSH.2 is the encoding characters (positions 4-7 typically)
  // Fields after that are pipe-separated starting at position 8+

  const segmentName = "MSH";
  const parts: string[] = [];

  // MSH segment name
  parts.push(`<span class="hl7-segment">MSH</span>`);

  // MSH.1 - Field Separator
  const fieldSep = line[3];
  const msh1Meta = getFieldMeta("MSH", 1);
  if (msh1Meta) {
    const title = `${msh1Meta.fieldId}: ${msh1Meta.longName}`;
    parts.push(`<span class="hl7-delim hl7-pipe" title="${escapeHtml(title)}">${escapeHtml(fieldSep)}</span>`);
  } else {
    parts.push(`<span class="hl7-delim hl7-pipe">${escapeHtml(fieldSep)}</span>`);
  }

  // Rest of the line after MSH|
  const rest = line.substring(4);
  const fieldValues = rest.split(fieldSep);

  // MSH.2 - Encoding Characters (first field after separator)
  if (fieldValues.length > 0) {
    const msh2Meta = getFieldMeta("MSH", 2);
    if (msh2Meta) {
      const title = `${msh2Meta.fieldId}: ${msh2Meta.longName}`;
      parts.push(`<span class="hl7-encoding" title="${escapeHtml(title)}">${escapeHtml(fieldValues[0])}</span>`);
    } else {
      parts.push(`<span class="hl7-encoding">${escapeHtml(fieldValues[0])}</span>`);
    }
  }

  // Process remaining fields (MSH.3 onwards)
  for (let i = 1; i < fieldValues.length; i++) {
    parts.push('<span class="hl7-delim hl7-pipe">|</span>');

    const fieldValue = fieldValues[i];
    const fieldIndex = i + 2; // MSH fields are offset by 2 (MSH.1 is separator, MSH.2 is encoding chars)

    if (!fieldValue) {
      continue;
    }

    const fieldMeta = getFieldMeta(segmentName, fieldIndex);

    if (fieldMeta) {
      const fieldDataType = fieldMeta.dataType;

      let inner: string;
      if (fieldValue.includes("~")) {
        inner = highlightRepetitions(fieldValue, fieldDataType, segmentName, fieldIndex);
      } else if (fieldValue.includes("^")) {
        inner = highlightComponents(fieldValue, fieldDataType, segmentName, fieldIndex);
      } else {
        inner = escapeHtml(fieldValue);
      }

      const title = `${fieldMeta.fieldId}: ${fieldMeta.longName} (${fieldMeta.dataType})${fieldMeta.required ? " [R]" : ""}`;
      parts.push(`<span class="hl7-field-wrap" title="${escapeHtml(title)}">${inner}</span>`);
    } else {
      parts.push(escapeHtml(fieldValue));
    }
  }

  return parts.join("");
}

/**
 * Highlight an entire HL7v2 message
 * @param hl7Message - The raw HL7v2 message (segments separated by \r or \n)
 * @returns HTML string with syntax highlighting and tooltips
 */
export function highlightHL7Message(hl7Message: string | undefined): string {
  if (!hl7Message) {
    return '<span class="text-gray-400">No HL7v2 message</span>';
  }

  // Split by CR (HL7v2 standard) or LF (for display purposes)
  const lines = hl7Message.split(/\r|\n/).filter((line) => line.trim());

  const highlightedLines = lines.map((line) => highlightSegment(line));

  return highlightedLines.join("\n");
}

/**
 * Get CSS styles for the highlighter
 */
export function getHighlightStyles(): string {
  return `
    .hl7-segment {
      color: #1e40af;
      font-weight: 600;
    }
    .hl7-delim {
      font-weight: bold;
    }
    .hl7-pipe {
      color: #2563eb;
    }
    .hl7-comp {
      color: #7c3aed;
    }
    .hl7-rep {
      color: #059669;
    }
    .hl7-sub {
      color: #dc2626;
    }
    .hl7-encoding {
      color: #ea580c;
      font-weight: 500;
    }
    .hl7-field {
      cursor: help;
      border-bottom: 1px dotted #9ca3af;
    }
    .hl7-field:hover {
      background-color: #fef3c7;
    }
    .hl7-field-wrap {
      cursor: help;
    }
    .hl7-field-wrap:hover {
      background-color: #dbeafe;
    }
  `;
}
