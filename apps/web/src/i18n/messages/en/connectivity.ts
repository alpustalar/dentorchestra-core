const connectivity = {
  Connectivity: {
    offlineTitle: 'You are offline',
    offlineDescription:
      'Cached data is being shown and may be out of date. Data will refresh automatically when the connection returns.',
    noCachedDataTitle: 'This section is unavailable offline',
    noCachedDataDescription:
      'No cached data is available on this device. The content will load automatically when the connection returns.',
  },
} as const;

export default connectivity;
