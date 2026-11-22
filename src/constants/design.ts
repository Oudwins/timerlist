export const palette = {
  background: '#28211D',
  surface: '#28211D',
  elevated: '#352D27',
  line: '#4B433E',
  text: '#F5F2EF',
  muted: '#BDB8B3',
  faint: '#716C67',
  orange: '#FF5722',
  ink: '#261B15',
  danger: '#F3978C',
};

function luminance(color: string) {
  const [red, green, blue] = [1, 3, 5].map(index => {
    const channel = parseInt(color.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// Text placed on a timer colour: whichever of ink or cream contrasts more with it.
export function onColor(color: string) {
  const background = luminance(color);
  const contrast = (foreground: string) => (Math.max(background, luminance(foreground)) + 0.05) / (Math.min(background, luminance(foreground)) + 0.05);
  return contrast(palette.ink) > contrast(palette.text) ? palette.ink : palette.text;
}
