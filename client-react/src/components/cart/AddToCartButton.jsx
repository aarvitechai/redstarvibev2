import { useDispatch, useSelector } from 'react-redux';
import { MAX_QUANTITY, itemAdded, selectQuantityOf } from '../../store/cartSlice';
import styles from './Cart.module.css';

// Any component can read or change the cart: no props passed down through the page, list and card
export default function AddToCartButton({ product }) {
  const dispatch = useDispatch();
  const inCart = useSelector(selectQuantityOf(product.id));
  const atMax = inCart >= MAX_QUANTITY;

  return (
    <button
      type="button"
      className={styles.add}
      onClick={() => dispatch(itemAdded({ id: product.id, name: product.name, price: product.price }))}
      disabled={atMax}
      aria-label={`Add ${product.name} to cart`}
    >
      {inCart > 0 ? `In cart: ${inCart} · Add one` : 'Add to cart'}
    </button>
  );
}
