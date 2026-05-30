import { test, expect } from '@playwright/test';

test('day-3-smart-recorder-test', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');

  await page.locator('xpath=//div[contains(@class,\'orangehrm-login-error\')]//div').click();
  await page.getByText('Username : Admin').click();
  await page.getByText('Username : Admin').click();
  await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
  await page.getByText('Password : admin123').click();
  await page.getByText('Password : admin123').click();
  await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/.*/);
});
