# ConceptMap Mapping Operations

This page defines four operations for managing individual mappings within large [ConceptMap](https://hl7.org/fhir/conceptmap.html) resources: `$add-mapping`, `$update-mapping`, `$remove-mapping`, and `$replace-element`.

## Background

The existing [$add](https://fhir.hl7.org/fhir/resource-operation-add.html) and [$remove](https://fhir.hl7.org/fhir/resource-operation-remove.html) operations (see [Operations for Large Resources](https://www.hl7.org/fhir/operations-for-large-resources.html)) return the modified resource and use structural matching on array entries. ConceptMap resources may contain thousands of mappings and require matching on a domain-specific composite key, so these operations return an OperationOutcome instead.

For all four operations, only `group` elements in the input are processed; all other elements are ignored.

## Matching Algorithm

`$add-mapping`, `$update-mapping`, and `$remove-mapping` use target-level matching. Two mappings match when they have identical values for `group.source`, `group.target`, `element.code`, and `element.target.code`.

For `noMap` entries (no `element.target`), matching uses `group.source`, `group.target`, and `element.code` only.

Only these fields are compared; other element properties such as `display` or `relationship` are not considered. To update an existing mapping's non-key properties, use `$update-mapping`.

`$replace-element` uses element-level matching: two elements match when they have identical values for `group.source`, `group.target`, and `element.code`. All targets and `noMap` state for the matched element are replaced atomically.

## $add-mapping Operation

The `$add-mapping` operation merges mappings into a ConceptMap, skipping any that already exist.

URL: [base]/ConceptMap/[id]/$add-mapping

The server SHALL add each input mapping that does not already exist. If an input mapping already exists (same match key), the server ignores it by default (`if-exists=ignore`) and SHOULD report skipped entries in the OperationOutcome; set `if-exists=fail` to return an error instead. If no `group` exists for the given `source` and `target`, one is created.

It is an error to add a mapping with `target` for a source code that already has `noMap=true`, or to add `noMap=true` for a code that already has target mappings.
It is also an error if the ConceptMap contains more than one group with the same `source` and `target` as an input mapping, since the target group is ambiguous.
In either case the server SHALL return an OperationOutcome with `severity=error` and `code=business-rule`.

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

The server SHALL replace each matching mapping with the input values; properties absent from the input are removed from the existing entry. If no matching mapping exists, the server SHALL add it. If no `group` exists for the given `source` and `target`, one is created.
The server SHOULD report the number of mappings updated and added in the OperationOutcome.

Like `$add-mapping`, it is an error to add a mapping with `target` for a source code that already has `noMap=true`, or to add `noMap=true` for a code that already has target mappings.
It is also an error if the ConceptMap contains more than one group with the same `source` and `target` as an input mapping, since the target group is ambiguous.
In either case the server SHALL return an OperationOutcome with `severity=error` and `code=business-rule`.

Clients MAY supply an `If-Match` header; servers SHALL reject the request if the ETag does not match. See [Managing Resource Contention](https://hl7.org/fhir/http.html#concurrency).

**In Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| mappings | 1..1 | ConceptMap | Only `group` elements are processed |

**Out Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| return | 1..1 | OperationOutcome | Outcome of the operation |

### Example

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

### Example

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

## $replace-element Operation

The `$replace-element` operation atomically replaces entire elements (all targets and `noMap` state) in a ConceptMap.

URL: [base]/ConceptMap/[id]/$replace-element

The server SHALL match each input element by `(group.source, group.target, element.code)` and replace the entire element with the input values. If no matching element exists, the server SHALL add it. If no `group` exists for the given `source` and `target`, one is created. The server SHOULD report the number of elements replaced and added in the OperationOutcome.

Unlike `$add-mapping` and `$update-mapping`, no `noMap` conflict check is performed — the input element replaces whatever was previously there, enabling atomic transitions between mapped and `noMap` states.

It is an error if the ConceptMap contains more than one group with the same `source` and `target` as an input element, since the target group is ambiguous. The server SHALL return an OperationOutcome with `severity=error` and `code=business-rule`.

Clients MAY supply an `If-Match` header; servers SHALL reject the request if the ETag does not match. See [Managing Resource Contention](https://hl7.org/fhir/http.html#concurrency).

**In Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| elements | 1..1 | ConceptMap | Only `group` elements are processed |

**Out Parameters**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| return | 1..1 | OperationOutcome | Outcome of the operation |

### Example

Request: atomically transition GLUC from a target mapping to `noMap`.

```http
POST /ConceptMap/lab-codes-to-loinc/$replace-element HTTP/1.1
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

Response: element replaced.

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "1 element replaced"
  }]
}
```

### Formal Definition

```json
{
  "resourceType": "OperationDefinition",
  "id": "ConceptMap-replace-element",
  "url": "http://hl7.org/fhir/OperationDefinition/ConceptMap-replace-element",
  "version": "6.0.0",
  "name": "ReplaceElement",
  "title": "Replace elements in a ConceptMap",
  "status": "draft",
  "kind": "operation",
  "affectsState": true,
  "code": "replace-element",
  "resource": ["ConceptMap"],
  "system": false,
  "type": false,
  "instance": true,
  "parameter": [
    {
      "name": "elements",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "ConceptMap containing elements to replace. Only group elements are processed.",
      "type": "ConceptMap"
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

Multiple groups with the same `source` and `target` within a single ConceptMap are permitted but discouraged. When different mapping subsets require different `unmapped` handling, they SHOULD be modeled as separate ConceptMap resources — subsets are a concept map-level concern.