import { useEffect, useOptimistic, useState } from 'react';
import ContactEditForm from '../components/contacts/ContactEditForm';
import ContactFormAction from '../components/contacts/ContactFormAction';
import ContactFormClassic from '../components/contacts/ContactFormClassic';
import ContactItem from '../components/contacts/ContactItem';
import { contactsApi } from '../services/contactsApi';
import { isAbortError } from '../services/http';
import styles from '../components/contacts/Contacts.module.css';

// The same order as the API: favourites first, then by name
const sortContacts = (list) =>
  list.toSorted((a, b) => Number(b.isFavourite) - Number(a.isFavourite) || a.name.localeCompare(b.name));

let pendingSeq = 0;

// Project 2: Contact List. Add (two ways), edit (react-hook-form), delete, favourite, all against the real API.
export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [load, setLoad] = useState({ loading: true, error: null });
  const [mode, setMode] = useState('actions');
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // useOptimistic: show a value right away, WHILE an action is running.
  // When the action finishes, React drops the optimistic version and shows the real `contacts` again:
  // on success that includes the saved contact, and on failure the fake row simply disappears (an automatic rollback).
  const [visibleContacts, addOptimisticContact] = useOptimistic(contacts, (current, pendingContact) =>
    sortContacts([...current, pendingContact]),
  );

  useEffect(() => {
    const controller = new AbortController();
    contactsApi
      .list({ signal: controller.signal })
      .then((list) => {
        setContacts(list);
        setLoad({ loading: false, error: null });
      })
      .catch((error) => {
        if (!isAbortError(error)) setLoad({ loading: false, error: error.message });
      });
    return () => controller.abort();
  }, []);

  const replace = (updated) => setContacts((list) => sortContacts(list.map((c) => (c.id === updated.id ? updated : c))));

  // Used by the CLASSIC form: wait for the server, then add the contact
  async function create(payload) {
    const created = await contactsApi.create(payload);
    setContacts((list) => sortContacts([...list, created]));
  }

  // Used by the ACTIONS form: runs inside its action (a transition), which is where useOptimistic may be called
  async function createOptimistically(payload) {
    addOptimisticContact({ ...payload, id: `pending-${++pendingSeq}`, pending: true });
    await create(payload);
  }

  async function run(id, work) {
    setBusyId(id);
    setActionError(null);
    try {
      await work();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyId(null);
    }
  }

  const toggleFavourite = (contact) =>
    run(contact.id, async () => replace(await contactsApi.setFavourite(contact.id, !contact.isFavourite)));

  const remove = (id) =>
    run(id, async () => {
      await contactsApi.remove(id);
      setContacts((list) => list.filter((c) => c.id !== id));
    });

  async function save(id, payload) {
    replace(await contactsApi.update(id, payload)); // errors go back to the edit form
    setEditingId(null);
  }

  return (
    <section id="contacts">
      <h2>Contacts</h2>

      <fieldset className={styles.modes}>
        <legend>Add form built with</legend>
        <label><input type="radio" name="mode" value="classic" checked={mode === 'classic'} onChange={() => setMode('classic')} /> onSubmit + useState</label>
        <label><input type="radio" name="mode" value="actions" checked={mode === 'actions'} onChange={() => setMode('actions')} /> React 19 Actions + useOptimistic</label>
      </fieldset>

      {mode === 'classic' ? <ContactFormClassic onCreate={create} /> : <ContactFormAction onCreate={createOptimistically} />}

      {actionError && <p role="alert" className={styles.formError}>{actionError}</p>}

      {load.loading && <p className={styles.muted}>Loading contacts…</p>}
      {load.error && <p role="alert" className={styles.formError}>Could not load contacts: {load.error}</p>}
      {!load.loading && !load.error && visibleContacts.length === 0 && <p className={styles.muted}>No contacts yet.</p>}

      <ul className={styles.list} aria-label="Contacts">
        {visibleContacts.map((contact) =>
          contact.id === editingId ? (
            <li key={contact.id} className={styles.item}>
              <ContactEditForm contact={contact} onSave={(payload) => save(contact.id, payload)} onCancel={() => setEditingId(null)} />
            </li>
          ) : (
            <ContactItem
              key={contact.id}
              contact={contact}
              busy={busyId === contact.id}
              onToggleFavourite={toggleFavourite}
              onEdit={setEditingId}
              onDelete={remove}
            />
          ),
        )}
      </ul>
    </section>
  );
}
