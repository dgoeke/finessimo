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

// Mock Path2D for canvas tests
global.Path2D = class Path2D {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_path?: string | Path2D) {
    // Mock implementation
  }

  addPath(_path: Path2D, _transform?: DOMMatrix2DInit): void {
    // Mock implementation
  }

  arc(
    _x: number,
    _y: number,
    _radius: number,
    _startAngle: number,
    _endAngle: number,
    _counterclockwise?: boolean,
  ): void {
    // Mock implementation
  }

  arcTo(
    _x1: number,
    _y1: number,
    _x2: number,
    _y2: number,
    _radius: number,
  ): void {
    // Mock implementation
  }

  bezierCurveTo(
    _cp1x: number,
    _cp1y: number,
    _cp2x: number,
    _cp2y: number,
    _x: number,
    _y: number,
  ): void {
    // Mock implementation
  }

  closePath(): void {
    // Mock implementation
  }

  ellipse(
    _x: number,
    _y: number,
    _radiusX: number,
    _radiusY: number,
    _rotation: number,
    _startAngle: number,
    _endAngle: number,
    _counterclockwise?: boolean,
  ): void {
    // Mock implementation
  }

  lineTo(_x: number, _y: number): void {
    // Mock implementation
  }

  moveTo(_x: number, _y: number): void {
    // Mock implementation
  }

  quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number): void {
    // Mock implementation
  }

  rect(_x: number, _y: number, _w: number, _h: number): void {
    // Mock implementation
  }

  roundRect(
    _x: number,
    _y: number,
    _w: number,
    _h: number,
    _radii?: number | DOMPointInit | Array<number | DOMPointInit>,
  ): void {
    // Mock implementation
  }
} as unknown as typeof Path2D;
