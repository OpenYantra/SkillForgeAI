# RESTful API Standards for Coding Agents

When drafting or implementing API contracts, adhere to these universal conventions:

---

## 1. Resource Naming
- Use plural nouns for resource paths: `/api/v1/orders`, not `/api/v1/order` or `/api/v1/getOrder`.
- Use kebab-case for multi-word paths: `/api/v1/order-items`.
- Use nesting strictly for direct child relationships: `/api/v1/orders/{orderId}/items`. Avoid nesting deeper than two levels.

---

## 2. HTTP Verbs & Semantics

| HTTP Verb | Action | Idempotent? | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | Read resource or collection | Yes | `200 OK`, `404 Not Found` |
| `POST` | Create resource or submit command | No (unless with `Idempotency-Key`) | `201 Created`, `400 Bad Request`, `409 Conflict` |
| `PUT` | Replace entire resource | Yes | `200 OK` or `204 No Content` |
| `PATCH` | Partially update resource | No (can be yes) | `200 OK`, `400 Bad Request` |
| `DELETE` | Remove resource | Yes | `204 No Content`, `404 Not Found` |

---

## 3. Standard Error Responses (RFC 7807)
Never return unstructured error messages like `{ "error": "something broke" }`.
Always follow RFC 7807 `application/problem+json`:
```json
{
  "type": "https://api.example.com/errors/item-conflict",
  "title": "Item Already Exists",
  "status": 409,
  "detail": "An item with name 'Analytics Module' already exists.",
  "instance": "/api/v1/items"
}
```
