# Phase 5: Forms and React 19 Actions (Project 2: Contact List)

**Goal:** a Contact List with add, edit, delete and favourite, built so you can compare form techniques side by side. Client validation for UX, **server validation always**.

## What was built

| Piece | React | Angular | Backend |
| --- | --- | --- | --- |
| Add (classic) | `components/contacts/ContactFormClassic.jsx`: controlled + `onSubmit` | `features/contacts/contact-form.ts`: Reactive Forms | `POST /api/contacts` |
| Add (Actions) | `ContactFormAction.jsx`: `useActionState` + `useFormStatus` | (same Reactive form) | — |
| Optimistic add | `pages/ContactsPage.jsx`: `useOptimistic` | `contacts-page.ts`: temporary row + rollback | — |
| Edit | `ContactEditForm.jsx`: react-hook-form + `Controller` | `contact-form.ts` in edit mode | `PUT /api/contacts/{id}` |
| Custom input | `FavouriteToggle.jsx` (value/onChange) | `favourite-toggle.ts` (`ControlValueAccessor` + `model()`) | `PUT /api/contacts/{id}/favourite` |
| Delete | two-step confirm in `ContactItem.jsx` | two-step confirm in `contact-item.ts` | `DELETE /api/contacts/{id}` |
| Rules | `utility/contactValidation.js` | `contact-validators.ts` (custom `ValidatorFn`s) | DataAnnotations in `ContactDtos.cs` |
| HTTP errors | `services/http.js` → `ApiError` | `core/http/api.ts` → `ApiError`, `unwrap()` | `ApiResponse.fieldErrors` |

## The error contract: per-field errors
```json
400 { "success": false, "errors": ["Name is required.", ...],
      "fieldErrors": { "name": ["Name is required."], "email": ["Enter a valid email address."] } }
409 { "success": false, "errors": ["Email '...' is already in use."], "fieldErrors": { "email": ["..."] } }
```
- The keys are **camelCase field names**, matching the clients' input names, so a form can do `setError(field, ...)` directly.
- One input can break several rules (for example, empty fails both `[Required]` and `[StringLength]`). The server returns all of them, and the forms show the **first**.
- JSON type errors (`"isFavourite": "yes"`) also land on the right field (`$.isFavourite` → `isFavourite`).

## Three ways to build a form (React)

| | Classic | Actions (React 19) | react-hook-form |
| --- | --- | --- | --- |
| Inputs | controlled (`value` + `onChange`) | uncontrolled (`defaultValue`, read with `FormData`) | uncontrolled, via `register()` |
| Re-render per keystroke | yes | no | no |
| Pending state | your own `useState` | `useFormStatus` / `isPending` | `formState.isSubmitting` |
| Errors | your own `useState` | returned from the action as the next state | `formState.errors`, `setError` |
| Best for | small forms, live UI from values | simple submit-and-save forms | large forms, many rules, custom inputs |

**Gotcha found while building:** React **resets an action form** once the action finishes, back to each input's `defaultValue`. So a failed action must return the typed values, and `defaultValue` must come from state, or a validation error wipes the user's input. A test covers this.

## Optimistic updates
- **React:** `useOptimistic(contacts, (cur, pending) => [...cur, pending])`, called inside the action (a transition). When the action ends, React shows the real `contacts` again: on success the row is now real, and on failure the fake row disappears (an automatic rollback).
- **Angular:** done by hand. Add a temporary row with a negative id, swap it for the server's contact on success, and remove it in `catchError` on failure, then rethrow so the form shows the field error.
- Both clients have **rollback tests** (a 409 removes the temporary row and shows the email error).

## Angular notes
- `FormBuilder.nonNullable`: `reset()` returns to the initial values instead of `null`.
- A **custom validator** is `(control) => null | errors`. Ours returns the message itself, so the template shows it directly.
- Server errors: `control.setErrors({ server: msg })`. The next edit re-runs the validators and clears them.
- `ControlValueAccessor` (`writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`) lets **any** component act as a form control. It's Angular's version of RHF's `Controller`.
- `form.disable()` while saving, then `enable()` **before** setting server errors, because `enable()` re-runs validation and would clear them.

## Backend notes
- `ApiResponse` gained `FieldErrors`, and `ValidationResponses` builds it from ModelState for **every** endpoint (students too).
- `TimeProvider` is injected into the contact service, and the tests use `FakeTimeProvider` to control "now".
- `PUT /{id}/favourite` is its own small endpoint, so starring a contact can't overwrite other fields edited somewhere else.

## Checkpoint: answer these out loud before Phase 6

**Q1. What do Actions replace?**
The boilerplate around submitting: `event.preventDefault()`, a `useState` for pending, a `useState` for errors, and `try/finally` to reset pending. With `<form action={fn}>` and `useActionState`, React runs the function in a **transition**. The function gets the `FormData` and returns the next state (errors or success). `useFormStatus` gives any button inside the form its pending state, and `useOptimistic` shows the expected result while the action runs.

**Q2. Why is server validation still required?**
Client validation runs in the user's browser, which the user controls. It's there for **fast feedback**, not security. Anyone can turn off JavaScript, edit the request in DevTools, or call the API with `curl` (the smoke test did exactly that). Only the server can enforce rules, and some rules **need** the server anyway, such as "email already in use" (409), because only the server knows the other contacts.

**Self-check:**
- Why does `useFormStatus` have to live in a child component of the `<form>`?
- Why do the Actions-form inputs use `defaultValue` and not `value`?
- What would the user see if `useOptimistic` were called outside the action?
- Why does the edit form's Save button start disabled?
- What does `noValidate` / `novalidate` change, and why use it here?
