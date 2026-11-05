import { baseApi } from './baseApi';

// Must match server/Server.Api/Models/Entities/OrderEntities.cs (OrderStatus): ONE list for API and UI
export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Ready', 'Completed', 'Cancelled'];

const MINE = { type: 'Order', id: 'MINE' };

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // The cart sends ONLY ids and quantities: the server prices the order (snapshot pricing)
    placeOrder: build.mutation({
      query: (items) => ({ url: '/orders', method: 'POST', body: { items: items.map(({ productId, quantity }) => ({ productId, quantity })) } }),
      invalidatesTags: [MINE], // "My orders" refetches and shows the new order
    }),

    getMyOrders: build.query({
      query: ({ page = 1, pageSize = 5 } = {}) => ({ url: '/orders/mine', params: { page, pageSize } }),
      providesTags: (result) => (result ? [...result.items.map(({ id }) => ({ type: 'Order', id })), MINE] : [MINE]),
    }),

    rateLine: build.mutation({
      query: ({ orderId, lineId, rating }) => ({ url: `/orders/${orderId}/details/${lineId}/rating`, method: 'PUT', body: { rating } }),
      invalidatesTags: (_result, _error, { orderId }) => [{ type: 'Order', id: orderId }],
    }),
  }),
});

export const { usePlaceOrderMutation, useGetMyOrdersQuery, useRateLineMutation } = ordersApi;
