# $add-mapping Operation for ConceptMap

**Status**: Draft proposal
**Target**: FHIR R4 / R5 (operation semantics are version-agnostic; R5 uses `relationship` instead of `equivalence`)

## Problem Statement

ConceptMaps can contain thousands of mappings. The current approach—fetch entire resource, modify, PUT—becomes expensive at scale. A targeted operation for adding individual mappings would be more efficient.

## Why a New Operation?

The R5 `$add` operation ([spec](https://hl7.org/fhir/R5/operations-for-large-resources.html)) supports only List and Group resources. ConceptMap cannot use it because:

1. **Nested structure**: ConceptMap has 3-level nesting (group → element → target), while `$add` assumes flat arrays. The matching algorithm cannot express "add a target to an element within a group."

2. **Context-dependent entries**: A ConceptMap mapping requires context (source system, source code) to locate where to insert. List/Group entries are self-contained.

The FHIR community acknowledges this gap. Per [FHIR Zulip discussion](https://chat.fhir.org/#narrow/channel/179166-implementers/topic/ConceptMap.20incremental.20updates/with/569790254), Grahame Grieve suggested creating a dedicated operation.

### Prior Art

[Smile CDR implements `$add-mapping`](https://smilecdr.com/docs/terminology/terminology_mapping.html#add-mapping) for this purpose. This proposal aligns with their parameter naming conventions.

---

## Specification

### URL Pattern

```
POST [base]/ConceptMap/[id]/$add-mapping
```

### Input Parameters

| Parameter | Cardinality | Type | Description |
|-----------|-------------|------|-------------|
| sourceSystem | 1..1 | uri | Source CodeSystem URI |
| sourceCode | 1..1 | code | Source code |
| sourceDisplay | 0..1 | string | Source code display name |
| targetSystem | 1..1 | uri | Target CodeSystem URI |
| targetCode | 1..1 | code | Target code |
| targetDisplay | 0..1 | string | Target code display name |
| equivalence | 1..1 | code | From [ConceptMapEquivalence](http://hl7.org/fhir/R4/valueset-concept-map-equivalence.html) |

> **R5**: Replace `equivalence` with `relationship` parameter, bound to [ConceptMapRelationship](http://hl7.org/fhir/R5/valueset-concept-map-relationship.html).

### Behavior

1. **Find or create group**: Locate group matching `sourceSystem` and `targetSystem`. Create if absent.

2. **Find or create element**: Within group, locate element matching `sourceCode`. Create if absent (with `sourceDisplay` if provided).

3. **Find or update target**: Within element, locate target matching `targetCode`:
   - If found with same `equivalence`: return success with `"Mapping already exists"` (idempotent)
   - If found with different `equivalence`: return 409 Conflict with `"Mapping exists with different equivalence"`
   - If not found: create target with `targetCode`, `targetDisplay`, and `equivalence`

4. **Return**: OperationOutcome with `"Mapping created"`.

### Output

Returns `OperationOutcome`:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "Mapping created"  // or "Mapping already exists"
  }]
}
```

### Error Conditions

| Condition | HTTP Status | Issue Code |
|-----------|-------------|------------|
| ConceptMap not found | 404 | not-found |
| Mapping exists with different equivalence | 409 | conflict |
| Invalid equivalence value | 400 | invalid |
| Missing required parameter | 400 | required |

### Concurrency

Servers SHOULD support optimistic locking. Clients MAY supply `If-Match` header per [FHIR HTTP Concurrency](https://hl7.org/fhir/http.html#concurrency).

### Security

Servers SHALL enforce authorization for ConceptMap write access. Implementations SHOULD log operation invocations for audit purposes.

---

## Example

### Request

```http
POST /fhir/ConceptMap/lab-codes-to-loinc/$add-mapping
Content-Type: application/fhir+json

{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "sourceSystem", "valueUri": "http://example.org/local-codes" },
    { "name": "sourceCode", "valueCode": "GLUC" },
    { "name": "sourceDisplay", "valueString": "Glucose Test" },
    { "name": "targetSystem", "valueUri": "http://loinc.org" },
    { "name": "targetCode", "valueCode": "2345-7" },
    { "name": "targetDisplay", "valueString": "Glucose [Mass/volume] in Serum or Plasma" },
    { "name": "equivalence", "valueCode": "equivalent" }
  ]
}
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/fhir+json
ETag: W/"2"

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "information",
    "code": "informational",
    "diagnostics": "Mapping created"
  }]
}
```

---

## Rationale

| Decision | Rationale |
|----------|-----------|
| Instance-level URL | Matches `$add` pattern, more RESTful than type-level with id parameter |
| `sourceX`/`targetX` naming | Symmetric, unambiguous; aligns with Smile CDR implementation |
| Equivalence required | Explicit semantics preferred over implicit defaults |
| Idempotent duplicates | Consistent with `$add` semantics; simplifies client retry logic |
| `affectsState: true` | Operation modifies the ConceptMap, but is still idempotent (same input = same result). These are orthogonal: `affectsState` indicates mutation, not whether retries are safe. |
| Conflict on equivalence mismatch | Prevents silent data inconsistency; caller must explicitly resolve |

---

## Future Considerations

- `$remove-mapping`: Delete specific mapping
- `$update-mapping`: Modify existing mapping's equivalence or display
- Batch support: Multiple mappings in single request

---

## References

- [Operations for Large Resources (R5)](https://hl7.org/fhir/R5/operations-for-large-resources.html)
- [FHIR Zulip: ConceptMap incremental updates](https://chat.fhir.org/#narrow/channel/179166-implementers/topic/ConceptMap.20incremental.20updates/with/569790254)
- [Smile CDR $add-mapping](https://smilecdr.com/docs/terminology/terminology_mapping.html#add-mapping)

---

## Appendix: OperationDefinition

```json
{
  "resourceType": "OperationDefinition",
  "id": "ConceptMap-add-mapping",
  "url": "http://hl7.org/fhir/OperationDefinition/ConceptMap-add-mapping",
  "version": "1.0.0",
  "name": "AddMapping",
  "title": "Add Mapping to ConceptMap",
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
      "name": "sourceSystem",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "The URI of the source CodeSystem",
      "type": "uri"
    },
    {
      "name": "sourceCode",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "The code in the source CodeSystem",
      "type": "code"
    },
    {
      "name": "sourceDisplay",
      "use": "in",
      "min": 0,
      "max": "1",
      "documentation": "Display name for the source code",
      "type": "string"
    },
    {
      "name": "targetSystem",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "The URI of the target CodeSystem",
      "type": "uri"
    },
    {
      "name": "targetCode",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "The code in the target CodeSystem",
      "type": "code"
    },
    {
      "name": "targetDisplay",
      "use": "in",
      "min": 0,
      "max": "1",
      "documentation": "Display name for the target code",
      "type": "string"
    },
    {
      "name": "equivalence",
      "use": "in",
      "min": 1,
      "max": "1",
      "documentation": "The degree of equivalence between source and target codes",
      "type": "code",
      "binding": {
        "strength": "required",
        "valueSet": "http://hl7.org/fhir/ValueSet/concept-map-equivalence"
      }
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
