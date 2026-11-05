import { Controller, useForm } from 'react-hook-form';
import { contactValidators, toContactPayload } from '../../utility/contactValidation';
import FavouriteToggle from './FavouriteToggle';
import Field from './Field';
import styles from './Contacts.module.css';

// VERSION 3: react-hook-form, for larger validated forms.
// register() wires native inputs WITHOUT a re-render on every keystroke (they're uncontrolled under the hood).
// <Controller> bridges custom components (our FavouriteToggle) that only speak value/onChange.
export default function ContactEditForm({ contact, onSave, onCancel }) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: { name: contact.name, email: contact.email, phone: contact.phone ?? '', isFavourite: contact.isFavourite },
    mode: 'onTouched', // validate a field after the user leaves it, then on every change
  });

  // The same rule functions as the other forms. RHF wants `true` for valid, or the message.
  const rule = (field) => ({ validate: (value) => contactValidators[field](value) ?? true });

  async function onSubmit(values) {
    try {
      await onSave(toContactPayload(values));
    } catch (error) {
      if (error.fieldErrors) {
        // Show the server's messages under the matching inputs
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field, { type: 'server', message: messages[0] }, { shouldFocus: true });
        }
      } else {
        setError('root.server', { type: 'server', message: error.message });
      }
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate aria-label={`Edit ${contact.name}`}>
      <Field label="Name" {...register('name', rule('name'))} error={errors.name?.message} />
      <Field label="Email" type="email" {...register('email', rule('email'))} error={errors.email?.message} />
      <Field label="Phone" type="tel" {...register('phone', rule('phone'))} error={errors.phone?.message} hint="Optional" />
      <div className={styles.check}>
        <Controller
          name="isFavourite"
          control={control}
          render={({ field }) => (
            <FavouriteToggle checked={field.value} onChange={field.onChange} onBlur={field.onBlur} />
          )}
        />
        Favourite
      </div>
      {errors.root?.server && <p role="alert" className={styles.formError}>{errors.root.server.message}</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={styles.button} onClick={onCancel} disabled={isSubmitting}>Cancel</button>
      </div>
    </form>
  );
}
