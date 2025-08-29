// Jest setup file to mock browser APIs for testing

// Mock document.hasFocus() to always return true in tests
Object.defineProperty(document, "hasFocus", {
  value: jest.fn().mockReturnValue(true),
  writable: true,
});

// Mock document.visibilityState to always be "visible" in tests
Object.defineProperty(document, "visibilityState", {
  value: "visible",
  writable: true,
});

// Mock document.hidden to always be false in tests
Object.defineProperty(document, "hidden", {
  value: false,
  writable: true,
});
