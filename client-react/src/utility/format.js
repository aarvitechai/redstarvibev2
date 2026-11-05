// Pure helpers shared by components. Keeping them out of component files keeps Fast Refresh working.
export const getInitials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

// One formatter instance, reused (creating Intl objects is relatively slow)
const priceFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
export const formatPrice = (value) => priceFormatter.format(value);
