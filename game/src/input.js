// Keyboard + mouse input. The live game reads the real devices; the
// screenshot stager drives the same shape with scripted values.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0, mouseY: 0, mouseDown: false,
    pressed: new Set(), // edge-triggered keys, consumed each step
    scripted: null,
  };
  const keyName = (e) => e.key.length === 1 ? e.key.toLowerCase() : e.key;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = keyName(e);
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => { input.keys.delete(keyName(e)); });
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseDown = true;
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

export function wasPressed(input, key) {
  return input.scripted ? !!input.scripted.pressed?.has(key) : input.pressed.has(key);
}

export function keyDown(input, key) {
  if (input.scripted) return !!input.scripted.keys?.has(key);
  return input.keys.has(key);
}

export function clearPressed(input) { input.pressed.clear(); }
