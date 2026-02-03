# Operation $add-mappings on ConceptMap

The `$add-mappings` operation adds one or more mappings to a ConceptMap resource without returning the full resource content.

The [$add](https://hl7.org/fhir/R5/resource-operation-add.html) operation supports only Group and List resources and returns the modified resource. For large ConceptMap resources, returning the full content is not practical.

The server SHALL add mappings from the input `group` elements. Two mappings are considered the same if they share the same `group.source`, `group.target`, `element.code`, and `target.code`.

- If a mapping does not exist, it is added.
- If a mapping exists with identical values for all fields, no action is taken.
- If a mapping exists with different values (e.g., different `relationship`, `display`, or `comment`), the server SHALL return an error.
- If a `group` with the specified `source` and `target` does not exist, it is created.

The operation is atomic: if any mapping causes an error, no mappings are added.

All ConceptMap elements outside of `group` are ignored.

URL: [base]/ConceptMap/[id]/$add-mappings

This is an idempotent operation.

Clients MAY supply an `If-Match` header with an ETag reflecting the current version of the ConceptMap. Servers SHALL reject the request if a supplied ETag does not match. See [Managing Resource Contention](https://hl7.org/fhir/http.html#concurrency).

**In Parameters:**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| mappings | 1..1 | ConceptMap | ConceptMap containing mappings to add. Only `group` elements are processed. |

**Out Parameters:**

| Name | Cardinality | Type | Documentation |
|------|-------------|------|---------------|
| return | 1..1 | OperationOutcome | Outcome of the operation |

## Examples

Request: Add a GLUC to LOINC mapping.

```http
POST /ConceptMap/lab-codes-to-loinc/$add-mappings HTTP/1.1
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
    "diagnostics": "Mappings added"
  }]
}
```

---

Response: Mapping exists with different values.

```http
HTTP/1.1 409 Conflict
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "conflict",
    "diagnostics": "Mapping exists with different relationship: GLUC -> 2345-7"
  }]
}
```
