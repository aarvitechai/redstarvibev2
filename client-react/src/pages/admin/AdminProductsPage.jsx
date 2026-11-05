import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import Modal from '../../components/admin/Modal';
import ProductFormDialog from '../../components/admin/ProductFormDialog';
import { useDeleteProductMutation, useGetAdminProductsQuery, useGetCategoriesQuery } from '../../store/api/adminApi';
import { imageSrc } from '../../services/productsApi';
import { formatPrice } from '../../utility/format';
import styles from '../../components/admin/Admin.module.css';
import formStyles from '../../components/contacts/Contacts.module.css';

// Project 9: manage products. Every change invalidates tags, so this table refreshes itself after a save.
export default function AdminProductsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const search = params.get('q') ?? '';
  const { data, isLoading, isFetching, error } = useGetAdminProductsQuery({ page, search });
  useGetCategoriesQuery(); // PREFETCH: the form needs them, so they're already cached when it opens
  const [deleteProduct, deleting] = useDeleteProductMutation();
  const [editing, setEditing] = useState(null); // null: closed | 'new' | a product
  const [confirming, setConfirming] = useState(null);

  async function confirmDelete() {
    try {
      await deleteProduct(confirming.id).unwrap();
      toast.success(`"${confirming.name}" is no longer for sale.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirming(null);
    }
  }

  return (
    <section aria-labelledby="admin-products-title">
      <title>Products · Admin · RedStarVibe</title>
      <div className={styles.titleRow}>
        <h1 id="admin-products-title">Products</h1>
        <button type="button" className={formStyles.primary} onClick={() => setEditing('new')}>New product</button>
      </div>
      <label className={styles.search}>
        Search
        <input type="search" defaultValue={search} placeholder="product name"
          onChange={(e) => setParams(e.target.value.trim() ? { q: e.target.value.trim() } : {}, { replace: true })} />
      </label>

      {error && <p role="alert" className={formStyles.formError}>{error.message}</p>}
      {isLoading ? (
        <p className={styles.muted}>Loading…</p>
      ) : data && (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-busy={isFetching}>
            <caption className={styles.muted}>{data.totalCount} products{isFetching && ' · updating…'}</caption>
            <thead>
              <tr><th scope="col">Image</th><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Status</th><th scope="col"><span className={styles.srOnly}>Actions</span></th></tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} aria-label={p.name}>
                  <td>{p.imageUrl ? <img className={styles.thumb} src={imageSrc(p.imageUrl)} alt="" width="48" height="27" /> : <span className={styles.muted}>—</span>}</td>
                  <td>{p.name}</td>
                  <td>{p.categoryName}</td>
                  <td>{formatPrice(p.price)}</td>
                  <td><span className={p.isActive ? styles.active : styles.inactive}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className={styles.rowActions}>
                    <button type="button" className={formStyles.button} onClick={() => setEditing(p)}>Edit</button>
                    {p.isActive && <button type="button" className={formStyles.danger} onClick={() => setConfirming(p)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.totalPages > 1 && (
            <nav className={styles.pager} aria-label="Pagination">
              <button type="button" className={formStyles.button} disabled={!data.hasPrevious} onClick={() => setParams({ ...(search && { q: search }), ...(page > 2 && { page: page - 1 }) })}>← Previous</button>
              <span>Page {data.page} of {data.totalPages}</span>
              <button type="button" className={formStyles.button} disabled={!data.hasNext} onClick={() => setParams({ ...(search && { q: search }), page: page + 1 })}>Next →</button>
            </nav>
          )}
        </div>
      )}

      {editing && <ProductFormDialog product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {confirming && (
        <Modal title="Delete product?" onClose={() => setConfirming(null)}>
          <p>"{confirming.name}" will be removed from the shop. Past orders keep their copy of it.</p>
          <div className={formStyles.actions}>
            <button type="button" className={formStyles.danger} onClick={confirmDelete} disabled={deleting.isLoading}>
              {deleting.isLoading ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" className={formStyles.button} onClick={() => setConfirming(null)}>Keep it</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
