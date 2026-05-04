# ConceptMap Mapping Operations

This page defines operations for managing individual mappings within large [ConceptMap](https://hl7.org/fhir/conceptmap.html) resources: `$add-mapping`, `$update-mapping`, and `$remove-mapping`.

## Background

The existing [$add](https://fhir.hl7.org/fhir/resource-operation-add.html) and [$remove](https://fhir.hl7.org/fhir/resource-operation-remove.html) operations (see [Operations for Large Resources](https://www.hl7.org/fhir/operations-for-large-resources.html)) return the modified resource and use structural matching on array entries. ConceptMap resources may contain thousands of mappings and require matching on a domain-specific composite key, so these operations return an OperationOutcome instead.

For all operations, only `group` elements in the input are processed; all other elements are ignored.

## Matching Algorithm

All three operations use target-level matching. Two mappings match when they have identical values for `group.source`, `group.target`, `element.code`, and `element.target.code`.

When `element.noMap` is `true`, there is no target code; matching uses `group.source`, `group.target`, and `element.code` only.

Only the match-key fields listed above are compared; other properties such as `display` or `relationship` are not considered during matching.

## $add-mapping Operation

The `$add-mapping` operation merges mappings into a ConceptMap, skipping any that already exist.

URL: [base]/ConceptMap/[id]/$add-mapping

The server SHALL add each input mapping that does not already exist. If no `group` exists for the given `source` and `target`, one is created.

If an input mapping already exists (same match key), the server ignores it by default (`if-exists=ignore`) and SHOULD report skipped entries in the OperationOutcome. Set `if-exists=fail` to return an error instead.

The server SHALL return an OperationOutcome with `severity=error` and `code=business-rule` when:
- A source code has `noMap=true` and the input adds a `target` mapping for it, or vice versa
- Multiple groups share the same `source` and `target` (ambiguous target group)

Clients MAY supply an `If-Match` header; servers SHALL reject the request if the ETag does not match. See [Managing Resource Contention](https://hl7.org/fhir/http.html#concurrency).

**In Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| mappings | 1..1 | ConceptMap | Only `group` elements are processed |
| if-exists | 0..1 | code | Behaviour when an input mapping already exists: `ignore` (default) — skip with SHOULD-report; `fail` — return an error |

**Out Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| return | 1..1 | OperationOutcome | Outcome of the operation |

### Example

Request: add a local code GLUC → LOINC mapping.

```http
POST /ConceptMap/lab-codes-to-loinc/$add-mapping HTTP/1.1
Content-Type: application/fhir+json

{
  "resourceType": "ConceptMap",
  "group": [{
    "source": "http://example.org/local-codes",
    "target": "http://loinc.org",
    "element": [{
      "code": "GLUC",
      "display": "Glucose",
      "target": [{
        "code": "2345-7",
        "display": "Glucose [Mass/volume] in Serum or Plasma",
        "relationship": "equivalent"
      }]
    }]
  }]
}
```

Response: mapping added.

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "1 mapping added"
  }]
}
```

Error response: addition conflicts with an existing `noMap` declaration.

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "business-rule",
    "diagnostics": "Cannot add mapping for code 'A': noMap already declared in group (source=http://example.org/local, target=http://loinc.org)"
  }]
}
```

Request: add GLUC → LOINC, failing if it already exists (`if-exists=fail` passed as query parameter).

```http
POST /ConceptMap/lab-codes-to-loinc/$add-mapping?if-exists=fail HTTP/1.1
Content-Type: application/fhir+json

{
  "resourceType": "ConceptMap",
  "group": [{
    "source": "http://example.org/local-codes",
    "target": "http://loinc.org",
    "element": [{
      "code": "GLUC",
      "display": "Glucose",
      "target": [{
        "code": "2345-7",
        "display": "Glucose [Mass/volume] in Serum or Plasma",
        "relationship": "equivalent"
      }]
    }]
  }]
}
```

Error response: mapping already exists.

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "duplicate",
    "diagnostics": "Mapping already exists for code 'GLUC' → '2345-7' in group (source=http://example.org/local-codes, target=http://loinc.org)"
  }]
}
```

### Formal Definition

```json
{
  "resourceType": "OperationDefinition",
  "id": "ConceptMap-add-mapping",
  "url": "http://hl7.org/fhir/OperationDefinition/ConceptMap-add-mapping",
  "version": "6.0.0",
  "name": "AddMapping",
  "title": "Add mappings to a ConceptMap",
  "status": "draft",
  "kind": "operation",
  "affectsState": true,
  "code": "add-mapping",
  "resource": ["ConceptMap"],
  "system": false,
  "type": false,
  "instance": true,
  "parameter": [
    {
      "name": "mappings",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "ConceptMap containing mappings to add. Only group elements are processed.",
      "type": "ConceptMap"
    },
    {
      "name": "if-exists",
      "use": "in",
      "min": 0,
      "max": "1",
      "documentation": "Behaviour when an input mapping already exists: 'ignore' (default) — skip with SHOULD-report; 'fail' — return an error.",
      "type": "code"
    },
    {
      "name": "return",
      "use": "out",
      "min": 1,
      "max": "1",
      "documentation": "Outcome of the operation",
      "type": "OperationOutcome"
    }
  ]
}
```

## $update-mapping Operation

The `$update-mapping` operation ensures mappings in a ConceptMap match the input, updating existing entries and adding new ones.

URL: [base]/ConceptMap/[id]/$update-mapping

The server SHALL replace each matching mapping with the input values; properties absent from the input are removed from the existing entry. If no matching mapping exists, the server SHALL add it.

When the input conflicts with existing `noMap` state, the server SHALL auto-resolve by default:
- Input adds a `target` for a `noMap` element — clear `noMap`, then add the target
- Input sets `noMap=true` for an element with targets — remove all existing targets, then set `noMap`

Set `on-conflict=fail` to return an error instead of auto-resolving.

If no `group` exists for the given `source` and `target`, one is created. The server SHOULD report the number of mappings updated and added in the OperationOutcome.

The server SHALL return an OperationOutcome with `severity=error` and `code=business-rule` when:
- Multiple groups share the same `source` and `target` (ambiguous target group)
- `on-conflict` is `fail` and the input conflicts with existing `noMap` state

Clients MAY supply an `If-Match` header; servers SHALL reject the request if the ETag does not match. See [Managing Resource Contention](https://hl7.org/fhir/http.html#concurrency).

**In Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| mappings | 1..1 | ConceptMap | Only `group` elements are processed |
| on-conflict | 0..1 | code | Behaviour when input conflicts with existing `noMap` state: `resolve` (default) — auto-resolve by clearing the conflicting state; `fail` — return an error |

**Out Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| return | 1..1 | OperationOutcome | Outcome of the operation |

### Examples

Request: update the relationship of an existing GLUC → 2345-7 mapping and add a new BUN → 3094-0 mapping in one call.

```http
POST /ConceptMap/lab-codes-to-loinc/$update-mapping HTTP/1.1
Content-Type: application/fhir+json

{
  "resourceType": "ConceptMap",
  "group": [{
    "source": "http://example.org/local-codes",
    "target": "http://loinc.org",
    "element": [
      {
        "code": "GLUC",
        "display": "Glucose",
        "target": [{
          "code": "2345-7",
          "display": "Glucose [Mass/volume] in Serum or Plasma",
          "relationship": "source-is-narrower-than-target"
        }]
      },
      {
        "code": "BUN",
        "display": "Blood Urea Nitrogen",
        "target": [{
          "code": "3094-0",
          "display": "Urea nitrogen [Mass/volume] in Serum or Plasma",
          "relationship": "equivalent"
        }]
      }
    ]
  }]
}
```

Response: one mapping updated, one added.

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "1 mapping updated, 1 mapping added"
  }]
}
```

Request: transition GLUC from a target mapping to `noMap`.

```http
POST /ConceptMap/lab-codes-to-loinc/$update-mapping HTTP/1.1
Content-Type: application/fhir+json

{
  "resourceType": "ConceptMap",
  "group": [{
    "source": "http://example.org/local-codes",
    "target": "http://loinc.org",
    "element": [{
      "code": "GLUC",
      "noMap": true
    }]
  }]
}
```

Response: mapping updated.

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "1 mapping updated"
  }]
}
```

### Formal Definition

```json
{
  "resourceType": "OperationDefinition",
  "id": "ConceptMap-update-mapping",
  "url": "http://hl7.org/fhir/OperationDefinition/ConceptMap-update-mapping",
  "version": "6.0.0",
  "name": "UpdateMapping",
  "title": "Update or add mappings in a ConceptMap",
  "status": "draft",
  "kind": "operation",
  "affectsState": true,
  "code": "update-mapping",
  "resource": ["ConceptMap"],
  "system": false,
  "type": false,
  "instance": true,
  "parameter": [
    {
      "name": "mappings",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "ConceptMap containing mappings to update or add. Only group elements are processed.",
      "type": "ConceptMap"
    },
    {
      "name": "on-conflict",
      "use": "in",
      "min": 0,
      "max": "1",
      "documentation": "Behaviour when input conflicts with existing noMap state: 'resolve' (default) — auto-resolve by clearing the conflicting state; 'fail' — return an error.",
      "type": "code"
    },
    {
      "name": "return",
      "use": "out",
      "min": 1,
      "max": "1",
      "documentation": "Outcome of the operation",
      "type": "OperationOutcome"
    }
  ]
}
```

## $remove-mapping Operation

The `$remove-mapping` operation removes mappings from a ConceptMap.

URL: [base]/ConceptMap/[id]/$remove-mapping

The server SHALL remove all mappings that match the input entries. If no matching mapping exists for an input entry, the server SHALL ignore it. If an input entry matches entries across more than one group, the server SHALL return an error by default (`on-multiple-match=fail`); set `on-multiple-match=remove-all` to remove from all matching groups.

Clients MAY supply an `If-Match` header; servers SHALL reject the request if the ETag does not match. See [Managing Resource Contention](https://hl7.org/fhir/http.html#concurrency).

**In Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| mappings | 1..1 | ConceptMap | Only `group` elements are processed |
| on-multiple-match | 0..1 | code | Behaviour when an input entry matches entries across more than one group: `fail` (default) — return an error; `remove-all` — remove from all matching groups |

**Out Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| return | 1..1 | OperationOutcome | Outcome of the operation |

### Examples

Request: remove the GLUC → LOINC mapping.

```http
POST /ConceptMap/lab-codes-to-loinc/$remove-mapping HTTP/1.1
Content-Type: application/fhir+json

{
  "resourceType": "ConceptMap",
  "group": [{
    "source": "http://example.org/local-codes",
    "target": "http://loinc.org",
    "element": [{
      "code": "GLUC",
      "target": [{
        "code": "2345-7"
      }]
    }]
  }]
}
```

Response: mapping removed.

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "1 mapping removed"
  }]
}
```

Request: remove the GLUC → 2345-7 mapping from all groups when duplicate groups exist.

```http
POST /ConceptMap/lab-codes-to-loinc/$remove-mapping?on-multiple-match=remove-all HTTP/1.1
Content-Type: application/fhir+json

{
  "resourceType": "ConceptMap",
  "group": [{
    "source": "http://example.org/local-codes",
    "target": "http://loinc.org",
    "element": [{
      "code": "GLUC",
      "target": [{
        "code": "2345-7"
      }]
    }]
  }]
}
```

Response: mapping removed from all matching groups.

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "2 mappings removed"
  }]
}
```

### Formal Definition

```json
{
  "resourceType": "OperationDefinition",
  "id": "ConceptMap-remove-mapping",
  "url": "http://hl7.org/fhir/OperationDefinition/ConceptMap-remove-mapping",
  "version": "6.0.0",
  "name": "RemoveMapping",
  "title": "Remove mappings from a ConceptMap",
  "status": "draft",
  "kind": "operation",
  "affectsState": true,
  "code": "remove-mapping",
  "resource": ["ConceptMap"],
  "system": false,
  "type": false,
  "instance": true,
  "parameter": [
    {
      "name": "mappings",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "ConceptMap containing mappings to remove. Only group elements are processed.",
      "type": "ConceptMap"
    },
    {
      "name": "on-multiple-match",
      "use": "in",
      "min": 0,
      "max": "1",
      "documentation": "Behaviour when an input entry matches entries across more than one group: 'fail' (default) — return an error; 'remove-all' — remove from all matching groups.",
      "type": "code"
    },
    {
      "name": "return",
      "use": "out",
      "min": 1,
      "max": "1",
      "documentation": "Outcome of the operation",
      "type": "OperationOutcome"
    }
  ]
}
```

## Notes

### Multiple groups with the same source and target

Multiple groups with the same `source` and `target` within a single ConceptMap are permitted but discouraged. When different mapping subsets require different `unmapped` handling, they SHOULD be modeled as separate ConceptMap resources — subsets are a concept map-level concern.
