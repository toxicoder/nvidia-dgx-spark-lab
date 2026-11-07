/**
 * PostCSS pipeline for the dashboard.
 *
 * Only the Tailwind v4 PostCSS plugin belongs here. Tailwind v4 loads its own
 * plugins from CSS, so `tailwindcss-animate` is registered with
 * `@plugin "tailwindcss-animate";` in `app/globals.css` — adding it here would
 * load it as a PostCSS plugin, which it is not, and the overlay animations would
 * still compile to nothing.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

export default config;
