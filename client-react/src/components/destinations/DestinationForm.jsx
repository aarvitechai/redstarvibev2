import { useState } from 'react';
import Field from '../contacts/Field';
import formStyles from '../contacts/Contacts.module.css';

const EMPTY = { name: '', country: '', description: '', rating: 4, isVisited: false };

// Used for both add and edit. `onSubmit` is an RTK Query mutation trigger (with .unwrap()), so it either resolves
// or throws { status, message, fieldErrors }, and the form shows the server's messages under the right inputs.
export default function DestinationForm({ initial = EMPTY, submitLabel, onSubmit, onCancel, label }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const value = field === 'rating' ? Number(e.target.value) : e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((er) => ({ ...er, [field]: undefined, _form: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const clientErrors = {};
    if (values.name.trim().length < 2) clientErrors.name = 'Name must be 2 to 80 characters.';
    if (values.country.trim().length < 2) clientErrors.country = 'Country must be 2 to 60 characters.';
    if (Object.keys(clientErrors).length) return setErrors(clientErrors);

    setSaving(true);
    try {
      await onSubmit({ ...values, name: values.name.trim(), country: values.country.trim(), description: values.description.trim() });
      if (initial === EMPTY) setValues(EMPTY); // the add form clears after saving; the edit form closes
    } catch (error) {
      setErrors(error.fieldErrors ? Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0]])) : { _form: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate aria-label={label}>
      <Field label="Name" value={values.name} onChange={set('name')} error={errors.name} />
      <Field label="Country" value={values.country} onChange={set('country')} error={errors.country} />
      <Field label="Description" value={values.description} onChange={set('description')} error={errors.description} hint="Optional" />
      <label className={formStyles.check}>
        Rating
        <select value={values.rating} onChange={set('rating')}>
          {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{'★'.repeat(r)}</option>)}
        </select>
      </label>
      {errors._form && <p role="alert" className={formStyles.formError}>{errors._form}</p>}
      <div className={formStyles.actions}>
        <button type="submit" className={formStyles.primary} disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className={formStyles.button} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
