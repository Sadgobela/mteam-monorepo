// Runs before each test file, after Jest is ready.
beforeEach(() => {
  const store = jest.requireMock("expo-secure-store");
  store.getItemAsync.mockReset();
  store.getItemAsync.mockResolvedValue(null);
});
