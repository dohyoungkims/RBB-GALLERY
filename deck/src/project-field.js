/** The Clark Collection's existing moving collage, populated by Clayco projects. */
import { mountArtField } from './art-field.js';

export async function mountProjectField(host, { onSelect } = {}) {
  if (!host?.append) throw new TypeError('mountProjectField requires a host element.');
  const response = await fetch('assets/projects/cover-manifest.json');
  if (!response.ok) throw new Error(`Project cover manifest: ${response.status}`);
  const projects = await response.json();
  if (!Array.isArray(projects) || !projects.length) throw new Error('The project cover manifest is empty.');
  const scene = host.closest('.invitation-cover');
  scene?.classList.add('project-cover');
  host.setAttribute('aria-label', 'Clayco projects across four decades of building');
  const field = mountArtField(host, projects, { onSelect });
  const root = host.querySelector('.rbb-art-field');
  root?.setAttribute('aria-label', 'A moving field of Clayco project photographs and renderings');
  host.dataset.projectCount = String(projects.length);
  let disposed = false;
  return {
    count: projects.length,
    setActive(value) { if (!disposed) field.setActive(value); },
    setMotion(value) { if (!disposed) field.setMotion(value); },
    setFocus(amount) { if (!disposed) field.setFocus(amount); },
    seek(seconds) { if (!disposed) field.seek(seconds); },
    dispose() {
      if (disposed) return;
      disposed = true;
      field.dispose();
      scene?.classList.remove('project-cover');
      delete host.dataset.projectCount;
    },
  };
}
