# Operation $add-mapping on ConceptMap

The `$add-mapping` operation merges mappings into a ConceptMap, ignoring any that already exist.

The [$add](https://hl7.org/fhir/R5/resource-operation-add.html) operation supports only Group and List resources and returns the modified resource. For large ConceptMap resources, returning the full content is not practical.

The server SHALL add mappings from the input `group` elements. Two mappings match if they share the same `group.source`, `group.target`, `element.code`, and `target.code`.

- If a mapping does not exist, it is added.
- If a mapping already exists, it is ignored.
- If a `group` with the specified `source` and `target` does not exist, it is created.

All ConceptMap elements outside of `group` are ignored.

URL: [base]/ConceptMap/[id]/$add-mapping

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
