import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const emptySplitApi = createApi({
  reducerPath: 'proxyApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  tagTypes: ['Proxies', 'Mocks', 'Logs', 'Stats', 'Certificates', 'Ignores'],
  endpoints: () => ({}),
})
