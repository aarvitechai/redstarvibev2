import { baseApi } from './baseApi';

export const ADMIN_PAGE_SIZE = 10;
const PRODUCTS = { type: 'AdminProduct', id: 'LIST' };
const ORDERS = { type: 'AdminOrder', id: 'LIST' };

// Project 9: the admin app's server data. Same pattern as Phase 10: queries PROVIDE tags, mutations INVALIDATE them,
// so the table refreshes itself after every save, with no "reload" code in the components.
export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCategories: build.query({
      query: () => '/categories',
      keepUnusedDataFor: 600, // categories rarely change: keep them for 10 minutes
    }),

    getAdminProducts: build.query({
      query: ({ page = 1, search = '' } = {}) => ({
        url: '/admin/products',
        params: { page, pageSize: ADMIN_PAGE_SIZE, ...(search.trim() ? { search: search.trim() } : {}) },
      }),
      providesTags: (result) => (result ? [...result.items.map(({ id }) => ({ type: 'AdminProduct', id })), PRODUCTS] : [PRODUCTS]),
    }),

    createProduct: build.mutation({
      query: (body) => ({ url: '/admin/products', method: 'POST', body }),
      invalidatesTags: [PRODUCTS],
    }),

    // body includes the rowVersion the form LOADED: the server answers 409 if someone else saved in between
    updateProduct: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/products/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'AdminProduct', id }, PRODUCTS],
    }),

    deleteProduct: build.mutation({
      query: (id) => ({ url: `/admin/products/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'AdminProduct', id }, PRODUCTS],
    }),

    // multipart/form-data: pass a FormData body and fetchBaseQuery lets the browser set the Content-Type
    // (with the multipart boundary). Setting it by hand would break the upload.
    uploadProductImage: build.mutation({
      query: ({ id, file }) => {
        const form = new FormData();
        form.append('file', file);
        return { url: `/admin/products/${id}/image`, method: 'POST', body: form };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'AdminProduct', id }],
    }),

    getAdminOrders: build.query({
      query: ({ page = 1, status = '' } = {}) => ({
        url: '/orders',
        params: { page, pageSize: ADMIN_PAGE_SIZE, ...(status ? { status } : {}) },
      }),
      providesTags: (result) => (result ? [...result.items.map(({ id }) => ({ type: 'AdminOrder', id })), ORDERS] : [ORDERS]),
    }),

    updateOrderStatus: build.mutation({
      query: ({ id, status, rowVersion }) => ({ url: `/orders/${id}/status`, method: 'PUT', body: { status, rowVersion } }),
      // LIST too: the order may now belong under a different status filter
      invalidatesTags: (_r, _e, { id }) => [{ type: 'AdminOrder', id }, ORDERS],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useGetAdminProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useUploadProductImageMutation,
  useGetAdminOrdersQuery,
  useUpdateOrderStatusMutation,
} = adminApi;
