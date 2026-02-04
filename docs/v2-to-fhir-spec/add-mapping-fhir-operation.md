# ConceptMap Mapping Operations

This specification defines two operations for managing mappings in large ConceptMap resources: `$add-mapping` and `$remove-mapping`.

## Rationale

The [$add](https://hl7.org/fhir/R6/resource-operation-add.html) operation supports only Group and List resources and returns the modified resource. For large ConceptMap resources, returning the full content is not practical.

## $add-mapping operation

The `$add-mapping` operation merges mappings into a ConceptMap, ignoring any that already exist.

The server SHALL add mappings from the input `group` elements. Two mappings match if they share the same `group.source`, `group.target`, `element.code`, and `target.code`.

- If a mapping does not exist, it is added.
- If a mapping already exists, it is ignored.
- If a `group` with the specified `source` and `target` does not exist, it is created.

The server SHALL ignore all ConceptMap elements outside of `group`.

URL: [base]/ConceptMap/[id]/$add-mapping

This is not an idempotent operation.

Clients MAY supply an `If-Match` header with an ETag reflecting the current version of the ConceptMap. Servers SHALL reject the request if a supplied ETag does not match. See [Managing Resource Contention](https://hl7.org/fhir/http.html#concurrency).

**In Parameters:**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| mappings | 1..1 | ConceptMap | ConceptMap containing mappings to add. Only `group` elements are processed. |

**Out Parameters:**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| return | 1..1 | OperationOutcome | Outcome of the operation |

### Examples

Request: Add a GLUC to LOINC mapping.

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

---

Response: Mapping added successfully.

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "Mapping added"
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

## $remove-mapping operation

The `$remove-mapping` operation removes mappings from a ConceptMap.

The server SHALL remove mappings from the input `group` elements that match entries in the target ConceptMap.

Two mappings match if they share the same `group.source`, `group.target`, `element.code`, and `target.code`.

The server SHALL ignore all ConceptMap elements outside of `group`.

URL: [base]/ConceptMap/[id]/$remove-mapping

This is not an idempotent operation.

Clients MAY supply an `If-Match` header with an ETag reflecting the current version of the ConceptMap. Servers SHALL reject the request if a supplied ETag does not match. See [Managing Resource Contention](https://hl7.org/fhir/http.html#concurrency).

**In Parameters:**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| mappings | 1..1 | ConceptMap | ConceptMap containing mappings to remove. Only `group` elements are processed. |

**Out Parameters:**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| return | 1..1 | OperationOutcome | Outcome of the operation |

### Examples

Request: Remove the GLUC to LOINC mapping.

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

---

Response: Mapping removed successfully.

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "Mapping removed"
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
