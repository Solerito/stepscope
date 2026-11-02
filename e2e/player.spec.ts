import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const position = (page: Page) => page.getByTestId('position');
const explanation = (page: Page) => page.getByTestId('explanation');

/** En móvil los paneles están tras pestañas: abre la que haga falta. */
async function openPanel(page: Page, name: string) {
  const tab = page.getByRole('tab', { name, exact: true });
  if (await tab.isVisible()) await tab.click();
}

test.describe('catálogo', () => {
  test('lista los algoritmos y lleva a cada uno', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'StepScope' })).toBeVisible();
    await page.getByRole('link', { name: /Ordenación por inserción/ }).click();
    await expect(page.getByRole('heading', { name: 'Ordenación por inserción' })).toBeVisible();
    await expect(position(page)).toHaveText('Paso 1 de 37');
  });

  test('avisa si el algoritmo del enlace no existe', async ({ page }) => {
    await page.goto('/#/no-existe');
    await expect(page.getByRole('alert')).toContainText('no-existe');
  });

  test('pasa la revisión de accesibilidad', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'StepScope' })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
});

test.describe('reproductor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/insertion-sort');
    await expect(position(page)).toHaveText('Paso 1 de 37');
  });

  test('los botones avanzan, retroceden y van a los extremos', async ({ page }) => {
    await page.getByRole('button', { name: 'Paso siguiente' }).click();
    await expect(position(page)).toHaveText('Paso 2 de 37');
    await expect(explanation(page)).toHaveText('Guardo la clave 2');

    await page.getByRole('button', { name: 'Paso anterior' }).click();
    await expect(position(page)).toHaveText('Paso 1 de 37');

    await page.getByRole('button', { name: 'Ir al final' }).click();
    await expect(position(page)).toHaveText('Paso 37 de 37');
    await expect(explanation(page)).toHaveText('Array ordenado');
    await expect(page.getByRole('button', { name: 'Paso siguiente' })).toBeDisabled();

    await page.getByRole('button', { name: 'Ir al inicio' }).click();
    await expect(position(page)).toHaveText('Paso 1 de 37');
  });

  test('play llega al final solo y se detiene', async ({ page }) => {
    await page.getByLabel('Velocidad').selectOption('120');
    await page.getByRole('button', { name: 'Reproducir' }).click();
    await expect(position(page)).toHaveText('Paso 37 de 37', { timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  });

  test('la barra de progreso salta al paso indicado', async ({ page }) => {
    await page.getByRole('slider', { name: 'Progreso de la ejecución' }).fill('10');
    await expect(position(page)).toHaveText('Paso 11 de 37');
  });

  test('la línea activa sigue a la traza', async ({ page }) => {
    await openPanel(page, 'Código');
    const active = page.locator('li[aria-current="step"]');
    await expect(active).toContainText('for (let i = 1');
    await page.getByRole('button', { name: 'Paso siguiente' }).click();
    await expect(active).toContainText('const key = a[i]');
  });

  test('las variables siguen a la traza y señalan lo que cambia', async ({ page }) => {
    await openPanel(page, 'Variables');
    await page.getByRole('button', { name: 'Paso siguiente' }).click();
    const panel = page.locator('#panel-vars');
    await expect(panel).toContainText('key');
    await expect(panel).toContainText('cambia');
  });

  test('la entrada propia genera una traza nueva y se valida', async ({ page }) => {
    await openPanel(page, 'Entrada');
    const field = page.getByRole('textbox', { name: 'Array' });

    await field.fill('3, x');
    await expect(page.getByRole('alert')).toContainText('«x»');

    await field.fill('3, 1, 2');
    await expect(position(page)).toHaveText('Paso 1 de 12');
  });

  test('los generadores cambian la entrada', async ({ page }) => {
    await openPanel(page, 'Entrada');
    const field = page.getByRole('textbox', { name: 'Array' });
    const before = await field.inputValue();
    await page.getByRole('button', { name: 'Inverso' }).click();
    await expect(field).not.toHaveValue(before);
  });

  test('el enlace reproduce exactamente el mismo paso y la misma entrada', async ({ page }) => {
    await openPanel(page, 'Entrada');
    await page.getByRole('textbox', { name: 'Array' }).fill('9, 4, 7, 1');
    await expect(position(page)).toHaveText(/de 2\d$/);

    await page.getByRole('slider', { name: 'Progreso de la ejecución' }).fill('7');
    const expected = await explanation(page).textContent();
    await expect(page).toHaveURL(/f=7/);

    await page.reload();
    await expect(position(page)).toHaveText(/^Paso 8 de/);
    await expect(explanation(page)).toHaveText(expected ?? '');
  });

  test('sin errores de accesibilidad en ningún panel', async ({ page }) => {
    for (const tab of ['Código', 'Variables', 'Contadores', 'Entrada']) {
      await openPanel(page, tab);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations, tab).toEqual([]);
    }
  });
});

test.describe('teclado', () => {
  test.skip(({ isMobile }) => isMobile, 'solo en escritorio');

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/insertion-sort');
    await expect(position(page)).toHaveText('Paso 1 de 37');
  });

  test('las flechas, Inicio y Fin controlan el reproductor', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await expect(position(page)).toHaveText('Paso 2 de 37');
    await page.keyboard.press('ArrowLeft');
    await expect(position(page)).toHaveText('Paso 1 de 37');
    await page.keyboard.press('End');
    await expect(position(page)).toHaveText('Paso 37 de 37');
    await page.keyboard.press('Home');
    await expect(position(page)).toHaveText('Paso 1 de 37');
  });

  test('Mayús + flecha salta entre hitos', async ({ page }) => {
    await page.keyboard.press('Shift+ArrowRight');
    await expect(explanation(page)).toContainText('toca colocar a[2]');
  });

  test('Espacio reproduce y pausa', async ({ page }) => {
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  });

  test('? abre la ayuda, y con ella abierta las teclas no mueven el reproductor', async ({ page }) => {
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog', { name: 'Atajos de teclado' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(position(page)).toHaveText('Paso 1 de 37');
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(dialog).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(position(page)).toHaveText('Paso 2 de 37');
  });

  test('las flechas no se apropian de un campo de texto', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Array' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(position(page)).toHaveText('Paso 1 de 37');
  });
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('un paso llega sin transición: la barra cambia de altura al instante', async ({ page }) => {
    await page.goto('/#/insertion-sort?values=5,2&f=2');
    await expect(position(page)).toHaveText('Paso 3 de 6');
    const pane = page.locator('[data-view="bars"] rect.ss-shape').nth(1);
    const before = await pane.getAttribute('height');
    await page.getByRole('button', { name: 'Paso siguiente' }).click();
    await expect(position(page)).toHaveText('Paso 4 de 6');
    // Sin esperar a ninguna animación, la altura ya es la final.
    expect(Number(await pane.getAttribute('height'))).toBeGreaterThan(Number(before));
  });
});

test.describe('recursión', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/fibonacci-memo');
    await expect(position(page)).toHaveText('Paso 1 de 37');
  });

  test('el árbol crece y las llamadas distinguen bajar de subir', async ({ page }) => {
    const nodes = page.locator('[data-view="call-tree"] ellipse.ss-shape');
    await expect(nodes).toHaveCount(1);
    await expect(explanation(page)).toContainText('Llamo a fib(6)');

    await page.getByRole('slider', { name: 'Progreso de la ejecución' }).fill('20');
    await expect(nodes).not.toHaveCount(1);

    await openPanel(page, 'Código');
    await page.getByRole('slider', { name: 'Progreso de la ejecución' }).fill('0');
    await expect(page.locator('li[aria-current="step"]')).toContainText('Llamada');
  });

  test('la pila apila y desapila', async ({ page }) => {
    await openPanel(page, 'Pila de llamadas');
    const frames = page.locator('[data-view="call-stack"] rect.ss-shape');
    await expect(frames).toHaveCount(1);
    await page.getByRole('slider', { name: 'Progreso de la ejecución' }).fill('12');
    await expect(frames.nth(1)).toBeAttached();
    await page.getByRole('slider', { name: 'Progreso de la ejecución' }).fill('36');
    await expect(frames).toHaveCount(1);
  });

  test('al terminar muestra lo que se ha ahorrado', async ({ page }) => {
    await page.getByRole('slider', { name: 'Progreso de la ejecución' }).fill('36');
    await openPanel(page, 'Contadores');
    const counters = page.locator('#panel-counters');
    await expect(counters).toContainText('Llamadas recursivas');
    await expect(counters).toContainText('11');
    await expect(counters).toContainText('Sin memoizar serían');
    await expect(counters).toContainText('25');
  });

  test('sin errores de accesibilidad', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
});

test.describe('fase 3: ordenación y búsqueda', () => {
  test('el catálogo tiene toda la ordenación y la búsqueda', async ({ page }) => {
    await page.goto('/');
    for (const name of ['Quicksort', 'Mergesort', 'Heapsort', 'Radix sort', 'Búsqueda binaria']) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
  });

  test('quicksort enseña barras y árbol a la vez en la platina, y la pila en el lateral', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'en móvil la platina solo enseña la primera vista');
    await page.goto('/#/quick-sort');
    await expect(position(page)).toHaveText(/^Paso 1 de/);
    await expect(page.locator('main [data-view="bars"]')).toBeVisible();
    await expect(page.locator('main [data-view="call-tree"]')).toBeVisible();
    await expect(page.locator('main figcaption', { hasText: 'Árbol de llamadas' })).toBeVisible();
    await expect(page.locator('#panel-call-stack [data-view="call-stack"]')).toBeAttached();
  });

  test('en móvil, las vistas que no caben en la platina pasan a pestañas', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo en móvil');
    await page.goto('/#/merge-sort');
    await expect(position(page)).toHaveText(/^Paso 1 de/);
    await expect(page.locator('main [data-view="call-tree"]')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Árbol de llamadas' }).click();
    await expect(page.locator('#panel-call-tree [data-view="call-tree"]')).toBeVisible();
    await page.getByRole('tab', { name: 'Auxiliar' }).click();
    await expect(page.locator('[data-view="bars"]').nth(1)).toBeVisible();
  });

  test('el pivote es un desplegable, cambia la ejecución y queda en el enlace', async ({ page }) => {
    await page.goto('/#/quick-sort?values=1,2,3,4,5,6,7,8&pivot=last');
    await expect(position(page)).toHaveText(/^Paso 1 de/);
    const worst = await position(page).textContent();
    await openPanel(page, 'Entrada');
    await page.getByLabel('Pivote', { exact: true }).selectOption('median3');
    await expect(position(page)).not.toHaveText(worst ?? '');
    await expect(page).toHaveURL(/pivot=median3/);
    await expect(page).toHaveURL(/fp=[0-9a-z]+/);
  });

  test('«solo hitos» avanza de pasada en pasada', async ({ page }) => {
    await page.goto('/#/bubble-sort?values=5,1,4,2,8,3');
    await expect(position(page)).toHaveText(/^Paso 1 de/);
    await page.getByLabel('Avanzar').selectOption('0');
    await page.getByRole('button', { name: 'Paso siguiente' }).click();
    await expect(explanation(page)).toContainText('Pasada');
    await page.getByLabel('Avanzar').selectOption('2');
    await page.getByRole('button', { name: 'Paso siguiente' }).click();
    await expect(explanation(page)).toContainText('¿a[0]');
  });

  test('el heapsort se ve como montículo', async ({ page }) => {
    await page.goto('/#/heap-sort');
    await expect(page.locator('main [data-view="heap-tree"] ellipse.ss-shape')).toHaveCount(7);
  });

  test('la búsqueda binaria exige el array ordenado', async ({ page }) => {
    await page.goto('/#/binary-search');
    await openPanel(page, 'Entrada');
    await page.getByRole('textbox', { name: 'Array ordenado' }).fill('5, 1, 3');
    await expect(page.getByRole('alert')).toContainText('ordenado de menor a mayor');
  });

  test('el panel de complejidad contrasta la teoría con lo que ha pasado', async ({ page }) => {
    await page.goto('/#/insertion-sort');
    await openPanel(page, 'Complejidad');
    await expect(page.getByTestId('complexity-contrast')).toContainText('12 comparaciones');
  });

  test('un enlace de otra versión del algoritmo avisa', async ({ page }) => {
    await page.goto('/#/insertion-sort?values=5,2,4&f=3&fp=distinto');
    await expect(page.getByRole('status').filter({ hasText: 'otra versión' })).toBeVisible();
    await page.goto('/#/insertion-sort?values=5,2,4&f=3');
    await page.reload();
    await expect(position(page)).toHaveText('Paso 4 de 12');
    await expect(page.getByRole('status').filter({ hasText: 'otra versión' })).toHaveCount(0);
  });

  test('copiar el enlace confirma que se ha copiado', async ({ page, browserName, isMobile, context }) => {
    test.skip(
      browserName !== 'chromium' || isMobile,
      'el permiso del portapapeles solo se puede dar en Chromium',
    );
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/#/insertion-sort');
    await page.getByRole('slider', { name: 'Progreso de la ejecución' }).fill('5');
    await page.getByRole('button', { name: 'Copiar enlace a este paso' }).click();
    await expect(page.getByText('Enlace copiado')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/#\/insertion-sort\?values=5,2,4,6,1,3&f=5&fp=/);
  });

  test('sin errores de accesibilidad en las páginas nuevas', async ({ page }) => {
    for (const id of [
      'quick-sort',
      'merge-sort',
      'heap-sort',
      'radix-sort',
      'counting-sort',
      'binary-search-answer',
    ]) {
      await page.goto(`/#/${id}`);
      await expect(position(page)).toHaveText(/^Paso 1 de/);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations, id).toEqual([]);
    }
  });
});
