import { useState } from 'react';
import {
  useDeleteDestinationMutation,
  useSetVisitedMutation,
  useUpdateDestinationMutation,
} from '../../store/api/destinationsApi';
import DestinationForm from './DestinationForm';
import styles from '../../pages/products/Products.module.css';
import formStyles from '../contacts/Contacts.module.css';

// Each card calls its own mutations. It never tells the page to "reload the list": the tags do that.
export default function DestinationCard({ destination: d, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [setVisited] = useSetVisitedMutation();
  const [updateDestination] = useUpdateDestinationMutation();
  const [deleteDestination, { isLoading: deleting, error: deleteError }] = useDeleteDestinationMutation();

  if (editing) {
    return (
      <li className={styles.card}>
        <DestinationForm
          label={`Edit ${d.name}`}
          initial={{ name: d.name, country: d.country, description: d.description, rating: d.rating, isVisited: d.isVisited }}
          submitLabel="Save"
          onSubmit={async (values) => {
            await updateDestination({ id: d.id, ...values }).unwrap(); // .unwrap(): resolve with data or THROW the error
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={styles.card} aria-label={d.name}>
      <span className={styles.badge}>{d.country}</span>
      <strong>{d.name}</strong>
      <span className={styles.muted}>{d.description}</span>
      <span aria-label={`Rating ${d.rating} of 5`}>{'★'.repeat(d.rating)}{'☆'.repeat(5 - d.rating)}</span>
      <label className={formStyles.check}>
        <input
          type="checkbox"
          checked={d.isVisited}
          disabled={!canEdit}
          onChange={(e) => setVisited({ id: d.id, isVisited: e.target.checked })} // optimistic: the cache flips at once
        />
        Visited
      </label>
      {canEdit && (
        <div className={formStyles.actions}>
          {confirming ? (
            <>
              <button type="button" className={formStyles.danger} disabled={deleting} onClick={() => deleteDestination(d.id)}>
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button type="button" className={formStyles.button} onClick={() => setConfirming(false)}>Keep</button>
            </>
          ) : (
            <>
              <button type="button" className={formStyles.button} onClick={() => setEditing(true)}>Edit</button>
              <button type="button" className={formStyles.button} onClick={() => setConfirming(true)}>Delete</button>
            </>
          )}
        </div>
      )}
      {deleteError && <p role="alert" className={styles.error}>{deleteError.message}</p>}
    </li>
  );
}
