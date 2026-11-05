import styles from './Contacts.module.css';

// A CUSTOM input: it's a button, not an <input>, so react-hook-form can't register() it.
// It has the same contract as a controlled input (value + onChange + onBlur), which is exactly what
// RHF's <Controller> provides. The contact list reuses it to star contacts directly.
export default function FavouriteToggle({ checked, onChange, onBlur, disabled, label = 'Favourite' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? styles.starOn : styles.starOff}
      onClick={() => onChange(!checked)}
      onBlur={onBlur}
      disabled={disabled}
    >
      {checked ? '★' : '☆'}
    </button>
  );
}
