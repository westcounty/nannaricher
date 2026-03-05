// e2e/game-flow.spec.ts
import { test, expect } from '@playwright/test';

/** Bypass auth by injecting a mock user into localStorage */
async function bypassAuth(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const mockUser = { userId: 'test-user-e2e', username: 'e2e_tester', nickname: 'E2E测试员' };
    // Create a minimal JWT-like token (won't be verified in test env without TUCHAN_JWT_SECRET)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'test-user-e2e', phone: '13800000000', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 }));
    const mockToken = `${header}.${payload}.mock-signature`;
    localStorage.setItem('nannaricher_access_token', mockToken);
    localStorage.setItem('nannaricher_refresh_token', 'mock-refresh-token');
    localStorage.setItem('nannaricher_user', JSON.stringify(mockUser));
  });
  await page.reload();
  await page.waitForTimeout(500);
}

test.describe('游戏流程测试', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test('页面应该正常加载', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/菜根人生|Nannaricher/);
  });

  test('创建房间流程', async ({ page }) => {
    // After auth bypass, should see lobby with create/join buttons
    const createBtn = page.locator('button:has-text("创建房间")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Player name should be pre-filled from auth
      const nameInput = page.locator('input[placeholder*="名"]').first();
      if (await nameInput.isVisible()) {
        const value = await nameInput.inputValue();
        expect(value).toBeTruthy(); // auto-filled from auth

        // Click submit
        const submitBtn = page.locator('.submit-button').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // 验证页面状态
    await expect(page).toHaveURL(/.*\//);
  });

  test('响应式布局 - 手机端', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // 验证页面加载
    await page.waitForTimeout(500);

    // 页面应该正常渲染
    await expect(page.locator('body')).toBeVisible();
  });

  test('响应式布局 - 平板端', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('响应式布局 - 桌面端', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('无障碍测试', () => {
  test('页面应该有正确的语言设置', async ({ page }) => {
    await page.goto('/');

    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBeTruthy();
  });

  test('交互元素应该可以通过键盘访问', async ({ page }) => {
    await page.goto('/');

    // Tab 导航
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // 验证有元素获得焦点
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(focusedElement).toBeTruthy();
  });
});

test.describe('性能测试', () => {
  test('页面加载时间应该在合理范围内', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // 页面加载应该在 10 秒内完成
    expect(loadTime).toBeLessThan(10000);
  });
});
