import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { toFormErrors, toContactPayload, validateContact } from '../../utility/contactValidation';
import Field from './Field';
import styles from './Contacts.module.css';

const EMPTY = { name: '', email: '', phone: '', isFavourite: false };
const INITIAL = { errors: {}, values: EMPTY };

// useFormStatus reads the pending state of the PARENT <form>, with no props needed.
// It must be in a component rendered INSIDE the form, which is why it's a separate component.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primary} disabled={pending}>
      {pending ? 'Saving…' : 'Add contact'}
    </button>
  );
}

// VERSION 2: React 19 Actions. UNCONTROLLED inputs, read once with FormData when the form is submitted.
// What Actions replace: the manual useState for errors + submitting, preventDefault, and try/finally.
//   useActionState(action, initialState) -> [state, formAction, isPending]
//   The action receives (previousState, formData) and returns the NEXT state.
export default function ContactFormAction({ onCreate }) {
  const [state, formAction] = useActionState(async (_prev, formData) => {
    const values = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      isFavourite: formData.get('isFavourite') === 'on',
    };

    const errors = validateContact(values);
    // Return the typed values too: React resets the form after an action, back to each input's defaultValue,
    // so defaultValue must hold what the user typed, or a validation error would wipe their input.
    if (Object.keys(errors).length) return { errors, values };

    try {
      await onCreate(toContactPayload(values)); // the parent shows it optimistically (useOptimistic)
      return INITIAL; // success: clear the form
    } catch (error) {
      return { errors: toFormErrors(error), values };
    }
  }, INITIAL);

  const { errors, values } = state;

  return (
    <form className={styles.form} action={formAction} noValidate aria-label="Add contact (actions)">
      <Field label="Name" name="name" defaultValue={values.name} error={errors.name} />
      <Field label="Email" name="email" type="email" defaultValue={values.email} error={errors.email} />
      <Field label="Phone" name="phone" type="tel" defaultValue={values.phone} error={errors.phone} hint="Optional" />
      <label className={styles.check}>
        <input type="checkbox" name="isFavourite" defaultChecked={values.isFavourite} /> Favourite
      </label>
      {errors._form && <p role="alert" className={styles.formError}>{errors._form}</p>}
      <SubmitButton />
    </form>
  );
}
