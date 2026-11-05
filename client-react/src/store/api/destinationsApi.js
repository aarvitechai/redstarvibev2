import { baseApi } from './baseApi';

export const DEFAULT_PAGE_SIZE = 6;

// The tag for "the whole list". Each item ALSO gets its own tag: { type: 'Destination', id }.
const LIST = { type: 'Destination', id: 'LIST' };

// Clean query params: drop empty values, so ?search=&visited= never reaches the API
const toParams = ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, search = '', visited = '' } = {}) => ({
  page,
  pageSize,
  ...(search.trim() ? { search: search.trim() } : {}),
  ...(visited === 'true' || visited === 'false' ? { visited } : {}),
});

export const destinationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // QUERY: GET. The argument is the cache key: page 1 and page 2 are cached separately.
    getDestinations: build.query({
      query: (args) => ({ url: '/destinations', params: toParams(args) }),
      // This list PROVIDES a tag per item, plus LIST. Editing item 3 refetches every page showing item 3;
      // adding an item (which could land on any page) invalidates LIST.
      providesTags: (result) => (result ? [...result.items.map(({ id }) => ({ type: 'Destination', id })), LIST] : [LIST]),
    }),

    getDestination: build.query({
      query: (id) => `/destinations/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Destination', id }],
    }),

    // MUTATIONS: POST/PUT/DELETE. invalidatesTags is what keeps every list on screen up to date.
    addDestination: build.mutation({
      query: (body) => ({ url: '/destinations', method: 'POST', body }),
      invalidatesTags: [LIST],
    }),

    updateDestination: build.mutation({
      query: ({ id, ...body }) => ({ url: `/destinations/${id}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Destination', id }, LIST], // LIST: the name (and so the sort order) may change
    }),

    deleteDestination: build.mutation({
      query: (id) => ({ url: `/destinations/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Destination', id }, LIST],
    }),

    // OPTIMISTIC UPDATE: flip the checkbox in the CACHE immediately, then undo it if the server says no.
    // (React's useOptimistic from Phase 5, done at the cache level, so every component showing it updates.)
    setVisited: build.mutation({
      query: ({ id, isVisited }) => ({ url: `/destinations/${id}/visited`, method: 'PUT', body: { isVisited } }),
      async onQueryStarted({ id, isVisited }, { dispatch, queryFulfilled, getState }) {
        // Patch every cached page that contains this destination
        const patches = destinationsApi.util
          .selectInvalidatedBy(getState(), [{ type: 'Destination', id }])
          .filter((entry) => entry.endpointName === 'getDestinations')
          .map(({ originalArgs, queryCacheKey }) => ({
            queryCacheKey,
            patch: dispatch(
              destinationsApi.util.updateQueryData('getDestinations', originalArgs, (draft) => {
                const item = draft.items.find((d) => d.id === id);
                if (item) item.isVisited = isVisited; // Immer again: a "mutation" on a draft of the cache
              }),
            ),
          }));
        try {
          await queryFulfilled;
        } catch {
          // ROLLBACK: the server refused, so put the old value back. But only where the cached entry STILL EXISTS:
          // a 401 makes the base query reset the whole cache, and undoing a patch on an entry that's gone crashes
          // inside Immer (a test caught this).
          for (const { queryCacheKey, patch } of patches) {
            if (getState().api.queries[queryCacheKey]?.data !== undefined) patch.undo();
          }
        }
      },
      // No invalidatesTags: the cache is already right, so a refetch would only be an extra request.
      // (If ?visited=false is filtering the list, the item stays until the next refetch; that's acceptable here.)
    }),
  }),
});

export const {
  useGetDestinationsQuery,
  useGetDestinationQuery,
  useAddDestinationMutation,
  useUpdateDestinationMutation,
  useDeleteDestinationMutation,
  useSetVisitedMutation,
  usePrefetch,
} = destinationsApi;
