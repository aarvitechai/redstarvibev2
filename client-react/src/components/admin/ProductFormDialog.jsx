import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  useCreateProductMutation,
  useGetCategoriesQuery,
  useUpdateProductMutation,
  useUploadProductImageMutation,
} from '../../store/api/adminApi';
import { imageSrc } from '../../services/productsApi';
import Field from '../contacts/Field';
import Modal from './Modal';
import formStyles from '../contacts/Contacts.module.css';
import styles from './Admin.module.css';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Create or edit a product (plan 14.5: modal form with react-hook-form, plus image upload).
// The checks here are for quick feedback; the API checks everything again (including the image's real bytes).
export default function ProductFormDialog({ product, onClose }) {
  const { data: categories, isLoading, error } = useGetCategoriesQuery();
  const title = product ? `Edit ${product.name}` : 'New product';

  // Render the form only once the categories are here. Otherwise the <select> mounts with no matching <option>,
  // its value becomes "" and the product's real category is lost (a bug the tests caught: Save said "Choose a category").
  if (isLoading || error) {
    return (
      <Modal title={title} onClose={onClose}>
        {error ? <p role="alert">Could not load categories: {error.message}</p> : <p role="status">Loading…</p>}
      </Modal>
    );
  }
  return <ProductForm product={product} categories={categories} title={title} onClose={onClose} />;
}

function ProductForm({ product, categories, title, onClose }) {
  const isEdit = Boolean(product);
  const [createProduct] = useCreateProductMutation();
  const [updateProduct] = useUpdateProductMutation();
  const [uploadImage] = useUploadProductImageMutation();
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: isEdit
      ? { name: product.name, description: product.description, price: product.price, categoryId: product.categoryId, isActive: product.isActive }
      : { name: '', description: '', price: '', categoryId: '', isActive: true },
  });

  function chooseFile(e) {
    const chosen = e.target.files?.[0] ?? null;
    setFileError(null);
    if (chosen && !IMAGE_TYPES.includes(chosen.type)) return setFileError('Choose a JPEG, PNG or WebP image.');
    if (chosen && chosen.size > MAX_IMAGE_BYTES) return setFileError('The image must be 2 MB or smaller.');
    setFile(chosen);
  }

  async function onSubmit(values) {
    const body = { ...values, price: Number(values.price), categoryId: Number(values.categoryId) };
    try {
      // 1. save the product (with the rowVersion we loaded, when editing)
      const saved = isEdit
        ? await updateProduct({ id: product.id, ...body, rowVersion: product.rowVersion }).unwrap()
        : await createProduct(body).unwrap();
      // 2. then the image, if one was chosen (an upload needs the product's id, which a new product only has now)
      if (file) await uploadImage({ id: saved.id, file }).unwrap();
      toast.success(isEdit ? `Saved "${saved.name}".` : `Created "${saved.name}".`);
      onClose();
    } catch (error) {
      if (error.status === 409) {
        // Someone else saved first. Close; the table refetches (tags), so the admin sees the latest version.
        toast.error(error.message);
        onClose();
        return;
      }
      if (error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field === 'file') setFileError(messages[0]);
          else setError(field, { type: 'server', message: messages[0] });
        }
      } else {
        toast.error(error.message);
      }
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className={styles.dialogForm} onSubmit={handleSubmit(onSubmit)} noValidate aria-label={isEdit ? 'Edit product' : 'New product'}>
        <Field label="Name" error={errors.name?.message}
          {...register('name', { required: 'Name is required.', minLength: { value: 2, message: 'Name must be 2 to 100 characters.' }, maxLength: { value: 100, message: 'Name must be 2 to 100 characters.' } })} />
        <Field label="Description" error={errors.description?.message}
          {...register('description', { maxLength: { value: 500, message: 'Description must be at most 500 characters.' } })} />
        <Field label="Price (₹)" type="number" step="0.01" min="0.01" error={errors.price?.message}
          {...register('price', { required: 'Price is required.', min: { value: 0.01, message: 'Price must be between 0.01 and 100000.' }, max: { value: 100000, message: 'Price must be between 0.01 and 100000.' } })} />
        <div className={formStyles.field}>
          <label htmlFor="product-category">Category</label>
          <select id="product-category" aria-invalid={errors.categoryId ? true : undefined}
            {...register('categoryId', { required: 'Choose a category.' })}>
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.categoryId && <small role="alert" className={formStyles.fieldError}>{errors.categoryId.message}</small>}
        </div>
        <label className={formStyles.check}>
          <input type="checkbox" {...register('isActive')} /> For sale (active)
        </label>
        <div className={formStyles.field}>
          <label htmlFor="product-image">Image (JPEG, PNG or WebP, up to 2 MB)</label>
          {isEdit && product.imageUrl && !file && <img className={styles.preview} src={imageSrc(product.imageUrl)} alt="" width="160" height="90" />}
          <input id="product-image" type="file" accept={IMAGE_TYPES.join(',')} onChange={chooseFile} aria-invalid={fileError ? true : undefined} />
          {fileError && <small role="alert" className={formStyles.fieldError}>{fileError}</small>}
        </div>
        <div className={formStyles.actions}>
          {/* disabled while saving: no double submits */}
          <button type="submit" className={formStyles.primary} disabled={isSubmitting || Boolean(fileError)}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
          <button type="button" className={formStyles.button} onClick={onClose} disabled={isSubmitting}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
