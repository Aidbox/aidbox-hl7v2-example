# ConceptMap Mapping Operations

This page defines two operations for managing individual mappings within large [ConceptMap](https://hl7.org/fhir/conceptmap.html) resources: `$add-mapping` and `$remove-mapping`.

## Background

The existing [$add](https://fhir.hl7.org/fhir/resource-operation-add.html) and [$remove](https://fhir.hl7.org/fhir/resource-operation-remove.html) operations (see [Operations for Large Resources](https://www.hl7.org/fhir/operations-for-large-resources.html)) return the modified resource and use structural matching on array entries. ConceptMap resources may contain thousands of mappings and require matching on a domain-specific composite key, so these operations return an OperationOutcome instead.

For both operations, only `group` elements in the input are processed; all other elements are ignored.

## Matching Algorithm

Both operations use the same matching algorithm. Two mappings match when they have identical values for `group.source`, `group.target`, `element.code`, and `element.target.code`.

For `noMap` entries (no `element.target`), matching uses `group.source`, `group.target`, and `element.code` only.

Only these fields are compared; other element properties such as `display` or `relationship` are not considered. To update an existing mapping, remove it first and add the replacement.

## $add-mapping Operation

The `$add-mapping` operation merges mappings into a ConceptMap, skipping any that already exist.

URL: [base]/ConceptMap/[id]/$add-mapping

The server SHALL add each input mapping that does not already exist. Existing mappings (same match key) are skipped; the server SHOULD report skipped entries in the OperationOutcome. If no `group` exists for the given `source` and `target`, one is created.

It is an error to add a mapping with `target` for a source code that already has `noMap=true`, or to add `noMap=true` for a code that already has target mappings. The server SHALL return an OperationOutcome with `severity=error` and `code=business-rule`.

This is not an idempotent operation.

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

The server SHALL remove all mappings that match the input entries, across all groups in the ConceptMap. If no matching mapping exists for an input entry, the server SHALL ignore it.

This is not an idempotent operation.

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
