import { useState } from 'react';
import FavouriteToggle from './FavouriteToggle';
import styles from './Contacts.module.css';

export default function ContactItem({ contact, busy, onToggleFavourite, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false); // a two-step delete: no accidental removals
  const { name, email, phone, isFavourite, pending } = contact;
  const disabled = busy || pending;

  return (
    <li className={pending ? styles.itemPending : styles.item} aria-label={name} aria-busy={pending || undefined}>
      <FavouriteToggle
        checked={isFavourite}
        onChange={() => onToggleFavourite(contact)}
        disabled={disabled}
        label={`Favourite ${name}`}
      />
      <div className={styles.itemBody}>
        <strong>{name}</strong>
        <span className={styles.muted}>{email}{phone && ` · ${phone}`}</span>
        {pending && <span className={styles.muted}>Saving…</span>}
      </div>
      <div className={styles.actions}>
        {confirming ? (
          <>
            <button type="button" className={styles.danger} onClick={() => onDelete(contact.id)} disabled={disabled}>
              Confirm delete
            </button>
            <button type="button" className={styles.button} onClick={() => setConfirming(false)}>Keep</button>
          </>
        ) : (
          <>
            <button type="button" className={styles.button} onClick={() => onEdit(contact.id)} disabled={disabled}>Edit</button>
            <button type="button" className={styles.button} onClick={() => setConfirming(true)} disabled={disabled}>Delete</button>
          </>
        )}
      </div>
    </li>
  );
}
