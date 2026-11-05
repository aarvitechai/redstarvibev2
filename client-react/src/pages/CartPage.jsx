import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router';
import { ROUTES } from '../constants/routes';
import {
  MAX_QUANTITY,
  cartCleared,
  itemRemoved,
  priceCart,
  quantityChanged,
  selectCartCount,
  selectCartItems,
  selectCartQuote,
  selectCartSubtotal,
} from '../store/cartSlice';
import { formatPrice } from '../utility/format';
import styles from '../components/cart/Cart.module.css';

// Project 4: the cart, read from and written to the Redux store
export default function CartPage() {
  const dispatch = useDispatch();
  const items = useSelector(selectCartItems);
  const count = useSelector(selectCartCount);
  const subtotal = useSelector(selectCartSubtotal); // memoized (createSelector)
  const quote = useSelector(selectCartQuote);
  const { quoteStatus, quoteError } = useSelector((s) => s.cart);

  if (items.length === 0) {
    return (
      <section aria-labelledby="cart-title">
        <title>Cart · RedStarVibe</title>
        <h1 id="cart-title">Your cart</h1>
        <p className={styles.muted}>Your cart is empty.</p>
        <Link to={ROUTES.products}>Browse products</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="cart-title">
      <title>{`Cart (${count}) · RedStarVibe`}</title>
      <h1 id="cart-title">Your cart</h1>

      <ul className={styles.lines} aria-label="Cart items">
        {items.map((item) => (
          <li key={item.productId} className={styles.line} aria-label={item.name}>
            <div className={styles.lineName}>
              <strong>{item.name}</strong>
              <span className={styles.muted}>{formatPrice(item.price)} each</span>
            </div>
            <div className={styles.qty}>
              <button type="button" className={styles.btn} aria-label={`One less ${item.name}`}
                onClick={() => dispatch(quantityChanged({ productId: item.productId, quantity: item.quantity - 1 }))}>−</button>
              <input type="number" min="1" max={MAX_QUANTITY} value={item.quantity} aria-label={`Quantity of ${item.name}`}
                onChange={(e) => dispatch(quantityChanged({ productId: item.productId, quantity: Number(e.target.value) || 1 }))} />
              <button type="button" className={styles.btn} aria-label={`One more ${item.name}`} disabled={item.quantity >= MAX_QUANTITY}
                onClick={() => dispatch(quantityChanged({ productId: item.productId, quantity: item.quantity + 1 }))}>+</button>
            </div>
            <span className={styles.lineTotal}>{formatPrice(item.price * item.quantity)}</span>
            <button type="button" className={styles.btn} onClick={() => dispatch(itemRemoved(item.productId))}>Remove</button>
          </li>
        ))}
      </ul>

      <div className={styles.summary} aria-label="Summary">
        <div className={styles.row}><span>Items</span><span>{count}</span></div>
        <div className={styles.row}>
          <span>Subtotal (in your browser)</span>
          <span data-testid="client-subtotal">{formatPrice(subtotal)}</span>
        </div>
        {quote && (
          <div className={`${styles.row} ${styles.total}`}>
            <span>Subtotal (checked by the server)</span>
            <span data-testid="server-subtotal">{formatPrice(quote.subtotal)}</span>
          </div>
        )}
        {quote?.unavailableProductIds.length > 0 && (
          <p role="alert" className={styles.warn}>Some products are no longer available and were removed.</p>
        )}
        {quoteError && <p role="alert" className={styles.warn}>{quoteError}</p>}
        <p className={styles.muted}>
          The browser total is for display only. At checkout (Phase 13) the server prices the order again from its own catalogue.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.add} onClick={() => dispatch(priceCart())} disabled={quoteStatus === 'pending'}>
            {quoteStatus === 'pending' ? 'Checking…' : 'Check prices with the server'}
          </button>
          <button type="button" className={styles.btn} onClick={() => dispatch(cartCleared())}>Empty cart</button>
        </div>
      </div>
    </section>
  );
}
