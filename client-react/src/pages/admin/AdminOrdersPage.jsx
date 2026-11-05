import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { useGetAdminOrdersQuery, useUpdateOrderStatusMutation } from '../../store/api/adminApi';
import { ORDER_STATUSES } from '../../store/api/ordersApi';
import { formatPrice } from '../../utility/format';
import styles from '../../components/admin/Admin.module.css';
import orderStyles from '../../components/orders/Orders.module.css';
import formStyles from '../../components/contacts/Contacts.module.css';

const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

// One row: the admin picks a next status from the ones the SERVER says are allowed (allowedNextStatuses)
function OrderRow({ order }) {
  const [next, setNext] = useState(order.allowedNextStatuses[0] ?? '');
  const [updateStatus, { isLoading }] = useUpdateOrderStatusMutation();

  async function apply() {
    try {
      await updateStatus({ id: order.id, status: next, rowVersion: order.rowVersion }).unwrap();
      toast.success(`Order #${order.id} is now ${next}.`);
    } catch (e) {
      // 409: another admin changed it first. The list refetches (tags), so the new status shows up.
      toast.error(e.status === 409 ? 'Someone else changed this order. The list has been refreshed.' : e.message);
    }
  }

  return (
    <tr aria-label={`Order ${order.id}`}>
      <td>#{order.id}</td>
      <td>{order.customerName}<br /><span className={styles.muted}>{order.customerEmail}</span></td>
      <td>{date.format(new Date(order.createdAt))}</td>
      <td>{order.itemCount}</td>
      <td>{formatPrice(order.total)}</td>
      <td><span className={orderStyles[`status${order.status}`]}>{order.status}</span></td>
      <td className={styles.rowActions}>
        {order.allowedNextStatuses.length === 0 ? (
          <span className={styles.muted}>Final</span>
        ) : (
          <>
            <label className={styles.srOnly} htmlFor={`next-${order.id}`}>Next status for order {order.id}</label>
            <select id={`next-${order.id}`} value={next} onChange={(e) => setNext(e.target.value)} disabled={isLoading}>
              {order.allowedNextStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className={formStyles.button} onClick={apply} disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Update'}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

// Plan 14.7: all orders (admin), with a status filter and status updates
export default function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';
  const { data, isLoading, isFetching, error } = useGetAdminOrdersQuery({ page, status });

  return (
    <section aria-labelledby="admin-orders-title">
      <title>Orders · Admin · RedStarVibe</title>
      <h1 id="admin-orders-title">Orders</h1>
      <label className={styles.search}>
        Status
        <select value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
          <option value="">All</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      {error && <p role="alert" className={formStyles.formError}>{error.message}</p>}
      {isLoading ? (
        <p className={styles.muted}>Loading…</p>
      ) : data && (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-busy={isFetching}>
            <caption className={styles.muted}>{data.totalCount} orders{isFetching && ' · updating…'}</caption>
            <thead>
              <tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Placed</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col">Change status</th></tr>
            </thead>
            <tbody>
              {/* key includes the status + rowVersion: after a refetch, the row (and its dropdown) starts fresh */}
              {data.items.map((o) => <OrderRow key={`${o.id}-${o.rowVersion}`} order={o} />)}
            </tbody>
          </table>
          {data.totalCount === 0 && <p className={styles.muted}>No orders{status && ` with status ${status}`}.</p>}
          {data.totalPages > 1 && (
            <nav className={styles.pager} aria-label="Pagination">
              <button type="button" className={formStyles.button} disabled={!data.hasPrevious} onClick={() => setParams({ ...(status && { status }), ...(page > 2 && { page: page - 1 }) })}>← Newer</button>
              <span>Page {data.page} of {data.totalPages}</span>
              <button type="button" className={formStyles.button} disabled={!data.hasNext} onClick={() => setParams({ ...(status && { status }), page: page + 1 })}>Older →</button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
