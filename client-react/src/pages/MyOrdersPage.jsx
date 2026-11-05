import { Link, useSearchParams } from 'react-router';
import StarRating from '../components/orders/StarRating';
import { ROUTES } from '../constants/routes';
import { useGetMyOrdersQuery, useRateLineMutation } from '../store/api/ordersApi';
import { formatPrice } from '../utility/format';
import styles from '../components/orders/Orders.module.css';
import pageStyles from './products/Products.module.css';

const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

// /orders: a Customer's own orders (ProtectedRoute roles=[Customer]; the API returns ONLY this user's orders anyway)
export default function MyOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const placedId = Number(params.get('placed')) || null;
  const { data, isLoading, isFetching, error, refetch } = useGetMyOrdersQuery({ page });
  const [rateLine, rating] = useRateLineMutation();

  return (
    <section aria-labelledby="orders-title">
      <title>My orders · RedStarVibe</title>
      <h1 id="orders-title">My orders</h1>
      {placedId && <p role="status" className={styles.success}>Thank you! Order #{placedId} has been placed.</p>}
      {rating.error && <p role="alert" className={pageStyles.error}>{rating.error.message}</p>}

      {error ? (
        <div role="alert" className={pageStyles.error}>
          Could not load your orders: {error.message}{' '}
          <button type="button" className={pageStyles.button} onClick={refetch}>Retry</button>
        </div>
      ) : isLoading ? (
        <p className={pageStyles.muted}>Loading…</p>
      ) : data.totalCount === 0 ? (
        <p className={pageStyles.muted}>No orders yet. <Link to={ROUTES.products}>Start shopping</Link></p>
      ) : (
        <>
          <ul className={styles.orders} aria-label="Orders" aria-busy={isFetching}>
            {data.items.map((order) => (
              <li key={order.id} className={styles.order} aria-label={`Order ${order.id}`}>
                <header className={styles.orderHead}>
                  <strong>Order #{order.id}</strong>
                  <span className={pageStyles.muted}>{date.format(new Date(order.createdAt))}</span>
                  <span className={styles[`status${order.status}`]}>{order.status}</span>
                </header>
                <table className={styles.lines}>
                  <thead>
                    <tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Price</th><th scope="col">Total</th>{order.canRate && <th scope="col">Your rating</th>}</tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.productName}</td>
                        <td>{line.quantity}</td>
                        <td>{formatPrice(line.unitPrice)}</td>
                        <td>{formatPrice(line.lineTotal)}</td>
                        {order.canRate && (
                          <td>
                            <StarRating value={line.rating} label={`Rate ${line.productName}`} disabled={rating.isLoading}
                              onRate={(n) => rateLine({ orderId: order.id, lineId: line.id, rating: n })} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><th scope="row" colSpan={3}>Total</th><td><strong>{formatPrice(order.total)}</strong></td>{order.canRate && <td />}</tr>
                  </tfoot>
                </table>
                {!order.canRate && order.status !== 'Cancelled' && (
                  <p className={pageStyles.muted}>You can rate the items once the order is completed.</p>
                )}
              </li>
            ))}
          </ul>
          {data.totalPages > 1 && (
            <nav className={pageStyles.pager} aria-label="Pagination">
              <button type="button" className={pageStyles.button} disabled={!data.hasPrevious} onClick={() => setParams(page - 1 > 1 ? { page: page - 1 } : {})}>← Newer</button>
              <span>Page {data.page} of {data.totalPages}</span>
              <button type="button" className={pageStyles.button} disabled={!data.hasNext} onClick={() => setParams({ page: page + 1 })}>Older →</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
