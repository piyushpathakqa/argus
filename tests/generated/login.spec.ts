import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should successfully log in with demo credentials', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');

    // Verify the login page is loaded
    const loginForm = page.getByTestId('login-form');
    await expect(loginForm).toBeVisible();

    // Verify the page title
    await expect(page).toHaveTitle('Argus Shop');

    // Verify demo hint is visible
    const demoHint = page.getByTestId('demo-hint');
    await expect(demoHint).toBeVisible();
    await expect(demoHint).toContainText('demo');

    // Fill in the username field
    const usernameInput = page.getByTestId('login-username');
    await expect(usernameInput).toBeVisible();
    await usernameInput.fill('demo');

    // Fill in the password field
    const passwordInput = page.getByTestId('login-password');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('demo');

    // Verify the inputs have the correct values
    await expect(usernameInput).toHaveValue('demo');
    await expect(passwordInput).toHaveValue('demo');

    // Click the submit button
    const submitButton = page.getByTestId('login-submit');
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Wait for navigation and verify successful login
    // After login, the user should be redirected away from /login
    await page.waitForURL(/^(?!.*\/login)/);
    
    // Verify we're no longer on the login page
    expect(page.url()).not.toContain('/login');
  });

  test('should display login form with all required fields', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');

    // Verify all form elements are visible
    const loginForm = page.getByTestId('login-form');
    await expect(loginForm).toBeVisible();

    const usernameInput = page.getByTestId('login-username');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute('type', 'text');

    const passwordInput = page.getByTestId('login-password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const submitButton = page.getByTestId('login-submit');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText('Sign in');

    // Verify inputs are initially empty
    await expect(usernameInput).toHaveValue('');
    await expect(passwordInput).toHaveValue('');
  });
});
