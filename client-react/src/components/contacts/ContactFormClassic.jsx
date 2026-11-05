import { useState } from 'react';
import { toFormErrors, toContactPayload, validateContact } from '../../utility/contactValidation';
import Field from './Field';
import styles from './Contacts.module.css';

const EMPTY = { name: '', email: '', phone: '', isFavourite: false };

// VERSION 1: the classic way. CONTROLLED inputs + onSubmit + useState for values, errors and submitting.
// Every keystroke goes through React state, so the UI always shows exactly what's in state.
export default function ContactFormClassic({ onCreate }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    setErrors((e) => ({ ...e, [name]: undefined, _form: undefined })); // clear an error once the user edits the field
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const clientErrors = validateContact(values);
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors); // stop here: no request for input we already know is bad
      return;
    }

    setSubmitting(true);
    try {
      await onCreate(toContactPayload(values));
      setValues(EMPTY);
      setErrors({});
    } catch (error) {
      setErrors(toFormErrors(error)); // the server can still reject it (e.g. a duplicate email gets 409)
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // noValidate: turn off the browser's own popups, so OUR messages (and the server's) are the ones shown
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label="Add contact (classic)">
      <Field label="Name" name="name" value={values.name} onChange={handleChange} error={errors.name} />
      <Field label="Email" name="email" type="email" value={values.email} onChange={handleChange} error={errors.email} />
      <Field label="Phone" name="phone" type="tel" value={values.phone} onChange={handleChange} error={errors.phone} hint="Optional" />
      <label className={styles.check}>
        <input type="checkbox" name="isFavourite" checked={values.isFavourite} onChange={handleChange} /> Favourite
      </label>
      {errors._form && <p role="alert" className={styles.formError}>{errors._form}</p>}
      <button type="submit" className={styles.primary} disabled={submitting}>
        {submitting ? 'Saving…' : 'Add contact'}
      </button>
    </form>
  );
}
