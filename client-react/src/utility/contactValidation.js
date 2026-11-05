// CLIENT validation = instant feedback (UX). It does NOT protect anything: the API validates again,
// because anyone can call the API without this page. Keep these rules and messages in line with
// server/Server.Api/Models/Dto/ContactDtos.cs.

export const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One function per field: return an error message, or undefined when the value is valid
export const contactValidators = {
  name: (value = '') => {
    const v = value.trim();
    if (!v) return 'Name is required.';
    if (v.length < 2 || v.length > 100) return 'Name must be 2 to 100 characters.';
    return undefined;
  },
  email: (value = '') => {
    const v = value.trim();
    if (!v) return 'Email is required.';
    if (!EMAIL_PATTERN.test(v)) return 'Enter a valid email address.';
    if (v.length > 200) return 'Email must be at most 200 characters.';
    return undefined;
  },
  phone: (value = '') => {
    const v = value.trim();
    if (v && !PHONE_PATTERN.test(v)) return 'Phone may contain digits, spaces, + ( ) - and be 7 to 20 characters.';
    return undefined;
  },
};

// Validate a whole contact -> { field: message } containing only the invalid fields
export function validateContact(values) {
  return Object.fromEntries(
    Object.entries(contactValidators)
      .map(([field, validate]) => [field, validate(values[field])])
      .filter(([, message]) => message),
  );
}

// The server sends { email: ["msg", ...] }; the forms show the first message for each field
export const firstErrors = (fieldErrors = {}) =>
  Object.fromEntries(Object.entries(fieldErrors ?? {}).map(([field, messages]) => [field, messages[0]]));

// Turn any thrown error into form errors: field errors when the server sent them, otherwise one form-level message
export const toFormErrors = (error) =>
  error?.fieldErrors ? firstErrors(error.fieldErrors) : { _form: error?.message ?? 'Something went wrong.' };

// What the API expects (trimmed, with an empty phone sent as null)
export const toContactPayload = (values) => ({
  name: values.name.trim(),
  email: values.email.trim(),
  phone: values.phone?.trim() || null,
  isFavourite: Boolean(values.isFavourite),
});
