import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const position = (page: Page) => page.getByTestId('position');
const side = (page: Page, letter: 'a' | 'b') => page.locator(`[data-side="${letter}"]`);
const explanation = (page: Page, letter: 'a' | 'b') => side(page, letter).getByTestId('explanation');
const picker = (page: Page, letter: 'A' | 'B') => page.getByRole('combobox', { name: `Algoritmo ${letter}` });

const QUICK_VS_MERGE = '/#/compare/quick-sort/merge-sort?values=38,27,43,3,9,82,10,3,55,21,64,12';

test.describe('comparación', () => {
  test('se llega desde el catálogo y enseña los dos lados con el mismo reloj', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Quicksort frente a mergesort/ }).click();
    await expect(page.getByRole('heading', { name: 'Comparar', level: 1 })).toBeVisible();
    await expect(picker(page, 'A')).toHaveValue('quick-sort');
    await expect(picker(page, 'B')).toHaveValue('merge-sort');
    await expect(position(page)).toHaveText(/^Operación 0 de \d+$/);
    await expect(side(page, 'a').locator('[data-view="bars"]')).toBeVisible();
    await expect(side(page, 'b').locator('[data-view="bars"]')).toBeVisible();
  });

  test('avanzar y retroceder mueven los dos lados a la par', async ({ page }) => {
    await page.goto(QUICK_VS_MERGE);
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    const before = [await explanation(page, 'a').textContent(), await explanation(page, 'b').textContent()];

    await page.getByRole('button', { name: 'Paso siguiente' }).click();
    await expect(position(page)).not.toHaveText(/^Operación 0 de/);
    const after = [await explanation(page, 'a').textContent(), await explanation(page, 'b').textContent()];
    expect(after).not.toEqual(before);

    await page.getByRole('button', { name: 'Paso anterior' }).click();
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    await expect(explanation(page, 'a')).toHaveText(before[0] ?? '');
    await expect(explanation(page, 'b')).toHaveText(before[1] ?? '');
  });

  test('al final, los dos han terminado y se sabe quién ha hecho menos', async ({ page }) => {
    await page.goto(QUICK_VS_MERGE);
    await page.getByRole('button', { name: 'Ir al final' }).click();
    await expect(side(page, 'a')).toContainText('Terminado');
    await expect(side(page, 'b')).toContainText('Terminado');
    await expect(page.getByTestId('verdict')).toContainText('termina antes');
    await expect(page.getByRole('table')).toContainText('Comparaciones');
  });

  test('reproduce hasta el final del más lento y se detiene', async ({ page }) => {
    await page.goto('/#/compare/insertion-sort/shell-sort?values=6,5,4,3,2,1');
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    await page.getByLabel('Velocidad').selectOption('1200');
    await page.getByRole('button', { name: 'Reproducir' }).click();
    await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible({ timeout: 5_000 });
    const [, done, total] = /Operación (\d+) de (\d+)/.exec((await position(page).textContent()) ?? '') ?? [];
    expect(done).toBe(total);
  });

  test('cambiar B conserva la entrada común', async ({ page }) => {
    await page.goto(QUICK_VS_MERGE);
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    await picker(page, 'B').selectOption('insertion-sort');
    await expect(page).toHaveURL(/compare\/quick-sort\/insertion-sort/);
    await expect(picker(page, 'B')).toHaveValue('insertion-sort');
    await expect(page.getByRole('textbox', { name: 'Array' })).toHaveValue(
      '38,27,43,3,9,82,10,3,55,21,64,12',
    );
  });

  test('con el mismo algoritmo, cada lado elige su variante y va al enlace', async ({ page, isMobile }) => {
    await page.goto('/#/compare/quick-sort/quick-sort?values=1,2,3,4,5,6,7,8&a.pivot=last&b.pivot=median3');
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    await expect(page.getByTestId('verdict')).toContainText('B termina antes');

    const onlyA = page.getByRole('group', { name: /Solo A/ });
    if (isMobile) await onlyA.scrollIntoViewIfNeeded();
    await onlyA.getByLabel('Pivote', { exact: true }).selectOption('median3');
    await expect(page.getByTestId('verdict')).toContainText('Los dos hacen las mismas operaciones');
    await expect(page).toHaveURL(/a\.pivot=median3/);
  });

  test('la entrada común exige lo que exigen los dos', async ({ page }) => {
    await page.goto('/#/compare/linear-search/binary-search');
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    await page.getByRole('textbox', { name: 'Array ordenado' }).fill('5, 1, 3');
    await expect(page.getByRole('alert')).toContainText('ordenado de menor a mayor');
  });

  test('el enlace reproduce el mismo instante en los dos lados', async ({ page }) => {
    await page.goto(QUICK_VS_MERGE);
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Paso siguiente' }).click();
    const readout = await position(page).textContent();
    const expected = [await explanation(page, 'a').textContent(), await explanation(page, 'b').textContent()];
    // La URL se escribe medio segundo después del último cambio: hay que esperar a la de este instante.
    const cost = /Operación (\d+)/.exec(readout ?? '')?.[1];
    await expect(page).toHaveURL(new RegExp(`op=${cost}&`));
    await expect(page).toHaveURL(/fp=[0-9a-z]+,[0-9a-z]+/);

    await page.reload();
    await expect(position(page)).toHaveText(readout ?? '');
    await expect(explanation(page, 'a')).toHaveText(expected[0] ?? '');
    await expect(explanation(page, 'b')).toHaveText(expected[1] ?? '');
  });

  test('un enlace de otra versión de los algoritmos avisa', async ({ page }) => {
    await page.goto(`${QUICK_VS_MERGE}&fp=viejo,viejo`);
    await expect(page.getByRole('status').filter({ hasText: 'otra versión' })).toBeVisible();
  });

  test('un algoritmo sin compañero lo dice en vez de inventarse una comparación', async ({ page }) => {
    // `binary-search-answer` es el único que queda sin pareja: su entrada son `weights` y `days`.
    await page.goto('/#/compare/binary-search-answer');
    await expect(page.getByText('no tiene todavía con quién compararse')).toBeVisible();
  });

  test('desde un algoritmo se compara con lo que se estaba viendo', async ({ page, isMobile }) => {
    test.skip(isMobile, 'en móvil las acciones de la cabecera no se muestran');
    await page.goto('/#/quick-sort?values=4,1,3,2&pivot=first');
    await page.getByRole('link', { name: 'Comparar con otro' }).click();
    await expect(picker(page, 'A')).toHaveValue('quick-sort');
    await expect(page.getByRole('textbox', { name: 'Array' })).toHaveValue('4,1,3,2');
    await expect(page).toHaveURL(/a\.pivot=first/);
  });

  test('sin errores de accesibilidad', async ({ page }) => {
    await page.goto(QUICK_VS_MERGE);
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
});

test.describe('comparación con teclado', () => {
  test.skip(({ isMobile }) => isMobile, 'solo en escritorio');

  test.beforeEach(async ({ page }) => {
    await page.goto(QUICK_VS_MERGE);
    await expect(position(page)).toHaveText(/^Operación 0 de/);
  });

  test('las flechas, Inicio, Fin y Espacio controlan el reloj común', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await expect(position(page)).not.toHaveText(/^Operación 0 de/);
    await page.keyboard.press('Home');
    await expect(position(page)).toHaveText(/^Operación 0 de/);
    await page.keyboard.press('End');
    await expect(side(page, 'b')).toContainText('Terminado');
    await page.keyboard.press('Home');
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  });

  test('la ayuda no ofrece lo que la comparación no tiene', async ({ page }) => {
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog', { name: 'Atajos de teclado' });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText('hitos');
    await expect(dialog).toContainText('Reproducir o pausar');
  });

  test('todo se alcanza con el tabulador, en un orden con sentido', async ({ page }) => {
    const reached: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      reached.push(
        await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null;
          if (element instanceof HTMLSelectElement) return element.value;
          return element?.getAttribute('aria-label') ?? element?.textContent?.trim().slice(0, 30) ?? '';
        }),
      );
    }
    const order = ['quick-sort', 'merge-sort', 'Aleatorio', 'Reproducir', 'Progreso de la ejecución'];
    const indexes = order.map((name) => reached.findIndex((label) => label.startsWith(name)));
    expect(
      indexes.every((index) => index >= 0),
      reached.join(' | '),
    ).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });
});
