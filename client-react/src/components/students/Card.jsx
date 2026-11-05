import styles from './Students.module.css';

// A generic "box" component. Through `children` it can wrap ANY content.
// That's composition: build small, generic pieces and combine them, instead of inheritance.
export default function Card({ as: Tag = 'article', children, ...rest }) {
  return (
    <Tag className={styles.card} {...rest}>
      {children}
    </Tag>
  );
}
