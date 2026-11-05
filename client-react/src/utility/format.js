// Pure helpers shared by components. Keeping them out of component files keeps Fast Refresh working.
export const getInitials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
